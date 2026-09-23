import { Parser, Quad, Store, Writer } from 'n3';

export class RmlPatchError extends Error {}

// RMLGenerator (see yarrrml_service/index.ts) always mints map nodes under
// this exact base IRI, and every RML document we produce declares it as the
// default `:` prefix -- these are always safe to assume when parsing a
// short snippet (an erroneous/corrected triple) that doesn't repeat the
// full document's own @prefix header.
const BASE_PREFIX_HEADER = [
  '@prefix : <http://mapping.example.com/> .',
  '@prefix rr: <http://www.w3.org/ns/r2rml#> .',
  '@prefix rml: <http://semweb.mmlab.be/ns/rml#> .',
  '@prefix ql: <http://semweb.mmlab.be/ns/ql#> .',
  '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
  '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
  // RML-FN (function-valued ObjectMaps, e.g. grel:string_replace for value
  // fixes plain rr:template/rml:reference concatenation can't express --
  // see proposeRepairPrompt.ts's "Value transform functions" rule). The
  // bundled RMLMapper jar ships the GREL function library, so these always
  // resolve at execution time regardless of whether the source mapping
  // happens to declare them.
  '@prefix fnml: <http://semweb.mmlab.be/ns/fnml#> .',
  '@prefix fno: <https://w3id.org/function/ontology#> .',
  '@prefix grel: <http://users.ugent.be/~bjdmeest/function/grel.ttl#> .',
].join('\n');

/** Pulls the leading `@prefix`/`@base` header lines off a serialized RML document. */
function extractPrefixHeader(rmlText: string): string {
  const lines = rmlText.split('\n');
  const header: string[] = [];
  for (const line of lines) {
    if (/^\s*@(prefix|base)\b/i.test(line)) {
      header.push(line);
    } else if (line.trim() === '') {
      continue;
    } else {
      break;
    }
  }
  return header.join('\n');
}

function parseSnippet(text: string, header: string): Quad[] {
  const parser = new Parser({ format: 'text/turtle' });
  return parser.parse(`${header}\n${text}`);
}

/**
 * Applies Stage 3's corrected_triples to a mapping's RML text, ported from
 * clustered-kg-refine's apply_fix_to_mapping() (codes/apply-fix-and-validate.py):
 * rather than a brittle exact-text substring match (an LLM asked to
 * "reproduce" a Turtle triple will often normalize `rr:template` to its full
 * `<http://www.w3.org/ns/r2rml#template>` IRI, or otherwise reformat
 * whitespace, breaking naive string replacement), this identifies each
 * target by the SUBJECT node the erroneous triple names, removes every
 * existing triple about that subject from the real, parsed RML graph, and
 * adds back whatever the corrected triple describes -- for that same
 * subject, plus (for the "add_missing_type" repair, which appends a whole
 * new TriplesMap alongside the untouched flagged node) any triples about a
 * different, brand-new subject in the same corrected string.
 *
 * Throws RmlPatchError if an erroneous triple's subject can't be parsed, or
 * doesn't actually exist in the given RML text (Stage 2 hallucinated it).
 */
export function applyRmlTextCorrection(
  rmlText: string,
  erroneousTriples: string[],
  correctedTriples: string[],
): string {
  const store = new Store(new Parser({ format: 'text/turtle' }).parse(rmlText));
  const header = `${BASE_PREFIX_HEADER}\n${extractPrefixHeader(rmlText)}`;

  for (let i = 0; i < erroneousTriples.length; i++) {
    const erroneous = erroneousTriples[i];
    const corrected = correctedTriples[i] ?? '';
    if (!erroneous?.trim()) continue;

    let erroneousQuads: Quad[];
    try {
      erroneousQuads = parseSnippet(erroneous, header);
    } catch (error) {
      throw new RmlPatchError(
        `Could not parse erroneous triple as Turtle: ${erroneous} (${error instanceof Error ? error.message : String(error)})`,
      );
    }
    const subject = erroneousQuads[0]?.subject;
    if (!subject) {
      throw new RmlPatchError(`Erroneous triple named no subject: ${erroneous}`);
    }

    const existing = store.getQuads(subject, null, null, null);
    if (existing.length === 0) {
      throw new RmlPatchError(
        `Stage 2 named node <${subject.value}> but no such node exists in the mapping -- likely hallucinated.`,
      );
    }
    for (const quad of existing) store.removeQuad(quad);

    if (!corrected.trim()) continue; // repair_type "delete_property"

    let correctedQuads: Quad[];
    try {
      correctedQuads = parseSnippet(corrected, header);
    } catch (error) {
      throw new RmlPatchError(
        `Corrected triple for <${subject.value}> did not parse as valid Turtle: ${corrected} (${error instanceof Error ? error.message : String(error)})`,
      );
    }
    if (correctedQuads.length === 0) {
      throw new RmlPatchError(
        `Corrected triple for <${subject.value}> produced no statements: ${corrected}`,
      );
    }
    for (const quad of correctedQuads) store.addQuad(quad);
  }

  const prefixes: Record<string, string> = {};
  for (const match of header.matchAll(/@prefix\s+(\w*):\s*<([^>]+)>/g)) {
    prefixes[match[1]] = match[2];
  }

  const writer = new Writer({ format: 'text/turtle', prefixes });
  writer.addQuads(store.getQuads(null, null, null, null));
  let result = '';
  writer.end((_err, res) => {
    result = res;
  });
  return result;
}
