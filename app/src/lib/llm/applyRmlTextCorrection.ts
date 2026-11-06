import { DataFactory, Parser, Quad, Store, Writer } from 'n3';

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

const RR = 'http://www.w3.org/ns/r2rml#';
// Predicates whose object is another map node that must itself be defined.
const MAP_LINK_PREDICATES = ['subjectMap', 'predicateObjectMap', 'predicateMap', 'objectMap'].map(
  local => DataFactory.namedNode(`${RR}${local}`),
);

/** Map nodes that are linked to (e.g. via rr:predicateObjectMap) but have no triples of their own. */
function undefinedMapNodes(store: Store): Set<string> {
  const missing = new Set<string>();
  for (const predicate of MAP_LINK_PREDICATES) {
    for (const quad of store.getQuads(null, predicate, null, null)) {
      if (quad.object.termType === 'Literal') continue;
      if (store.getQuads(quad.object, null, null, null).length === 0) {
        missing.add(quad.object.value);
      }
    }
  }
  return missing;
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
 * target by the SUBJECT node the erroneous triple names, removes the existing
 * triples about that subject for each PREDICATE the erroneous triple names
 * from the real, parsed RML graph, and adds back whatever the corrected
 * triple describes -- for that same
 * subject, plus (for the "add_missing_type" repair, which appends a whole
 * new TriplesMap alongside the untouched flagged node) any triples about a
 * different, brand-new subject in the same corrected string.
 *
 * Removal is scoped to the named predicates, not the whole subject:
 * RMLGenerator splits one node's triples across several statements (e.g.
 * `:map_x rr:subjectMap :s_x.` stands alone), so the statement Stage 2 quotes
 * is usually only part of what the RML says about that node. Clearing the
 * whole subject silently dropped the rest -- e.g. a TriplesMap's subject map
 * and predicate-object maps -- leaving an RML that maps nothing.
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
  const undefinedBefore = undefinedMapNodes(store);

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

    if (store.getQuads(subject, null, null, null).length === 0) {
      throw new RmlPatchError(
        `Stage 2 named node <${subject.value}> but no such node exists in the mapping -- likely hallucinated.`,
      );
    }
    if (!corrected.trim()) {
      // repair_type "delete_property": the whole node goes, not just the
      // predicates the (possibly partial) quoted statement happens to name,
      // and so do links to it (e.g. the TriplesMap's rr:predicateObjectMap).
      store.removeQuads(store.getQuads(subject, null, null, null));
      store.removeQuads(store.getQuads(null, null, subject, null));
      continue;
    }

    const namedPredicates = erroneousQuads
      .filter(quad => quad.subject.equals(subject))
      .map(quad => quad.predicate);
    for (const predicate of namedPredicates) {
      store.removeQuads(store.getQuads(subject, predicate, null, null));
    }

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

  // e.g. add_missing_property linking `:pom_new` from the TriplesMap but never
  // describing :pom_new itself -- RMLMapper would silently map nothing for it.
  const newlyUndefined = [...undefinedMapNodes(store)].filter(node => !undefinedBefore.has(node));
  if (newlyUndefined.length > 0) {
    throw new RmlPatchError(
      `Correction links map node(s) it never defines: ${newlyUndefined.map(n => `<${n}>`).join(', ')}`,
    );
  }

  return serializeRml(store, header);
}

/** Serializes with every triple about one subject grouped into one statement. */
function serializeRml(store: Store, header: string): string {
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

/**
 * Rewrites RMLGenerator output so each node is described by exactly one
 * statement. The generator scatters a node's triples (e.g. a TriplesMap's
 * rr:subjectMap / rr:predicateObjectMap links) across separate statements, so
 * a Stage 2 quote of "the" statement about a node would be partial and the
 * Stage 3 correction would be written without seeing the rest of the node.
 */
export function groupRmlBySubject(rmlText: string): string {
  const store = new Store(new Parser({ format: 'text/turtle' }).parse(rmlText));
  return serializeRml(store, `${BASE_PREFIX_HEADER}\n${extractPrefixHeader(rmlText)}`);
}
