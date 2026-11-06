import { Parser, Store } from 'n3';
import { describe, expect, test } from 'vitest';
import { applyRmlTextCorrection, groupRmlBySubject, RmlPatchError } from './applyRmlTextCorrection';

// Shape of RMLGenerator output: one subject's triples are split across
// several separate statements (e.g. `:map_person_000 rr:subjectMap :s_000.`
// stands alone), so an LLM quoting "the" statement about a node only ever
// sees part of what is said about it.
const RML = `
@prefix : <http://mapping.example.com/>.
@prefix rr: <http://www.w3.org/ns/r2rml#>.
@prefix rml: <http://semweb.mmlab.be/ns/rml#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

:map_person_000 rml:logicalSource :source_000;
    a rr:TriplesMap;
    <http://www.w3.org/2000/01/rdf-schema#label> "person".
:map_person_000 rr:subjectMap :s_000.
:s_000 rr:template "http://example.org/people/person/{id}".
:map_person_000 rr:predicateObjectMap :pom_001.
:pom_001 rr:predicateMap :pm_001.
:pm_001 rr:constant foaf:mbox.
:pom_001 rr:objectMap :om_001.
:om_001 a rr:ObjectMap;
    rml:reference "email";
    rr:termType rr:Literal.
`;

const M = 'http://mapping.example.com/';
const RR = 'http://www.w3.org/ns/r2rml#';
const RML_NS = 'http://semweb.mmlab.be/ns/rml#';

function objectsOf(ttl: string, subject: string, predicate: string): string[] {
  const store = new Store(new Parser({ format: 'text/turtle' }).parse(ttl));
  return store.getObjects(subject, predicate, null).map(o => o.value);
}

describe('applyRmlTextCorrection', () => {
  test('a no-op correction of a partial statement keeps the rest of the node', () => {
    const statement =
      ':map_person_000 rml:logicalSource :source_000;\n    a rr:TriplesMap;\n    <http://www.w3.org/2000/01/rdf-schema#label> "person".';
    const patched = applyRmlTextCorrection(RML, [statement], [statement]);

    expect(objectsOf(patched, `${M}map_person_000`, `${RR}subjectMap`)).toEqual([`${M}s_000`]);
    expect(objectsOf(patched, `${M}map_person_000`, `${RR}predicateObjectMap`)).toEqual([
      `${M}pom_001`,
    ]);
  });

  test('replaces only the predicates the erroneous snippet names', () => {
    const patched = applyRmlTextCorrection(
      RML,
      [':om_001 rr:termType rr:Literal.'],
      [':om_001 rr:termType rr:IRI.'],
    );

    expect(objectsOf(patched, `${M}om_001`, `${RR}termType`)).toEqual([`${RR}IRI`]);
    expect(objectsOf(patched, `${M}om_001`, `${RML_NS}reference`)).toEqual(['email']);
  });

  test('a predicate named in the erroneous snippet but left out of the correction is removed', () => {
    const patched = applyRmlTextCorrection(
      RML,
      [':om_001 a rr:ObjectMap; rml:reference "email"; rr:termType rr:Literal.'],
      [':om_001 a rr:ObjectMap; rml:reference "email".'],
    );

    expect(objectsOf(patched, `${M}om_001`, `${RR}termType`)).toEqual([]);
    expect(objectsOf(patched, `${M}om_001`, `${RML_NS}reference`)).toEqual(['email']);
  });

  test('rejects a correction that links a map node it never defines', () => {
    const statement =
      ':map_person_000 rml:logicalSource :source_000;\n    a rr:TriplesMap;\n    <http://www.w3.org/2000/01/rdf-schema#label> "person".';
    expect(() =>
      applyRmlTextCorrection(
        RML,
        [statement],
        [statement.replace('"person".', '"person";\n    rr:predicateObjectMap :pom_new.')],
      ),
    ).toThrow(RmlPatchError);
  });

  test('accepts a new map node that is linked and fully defined', () => {
    const statement =
      ':map_person_000 rml:logicalSource :source_000;\n    a rr:TriplesMap;\n    <http://www.w3.org/2000/01/rdf-schema#label> "person".';
    const patched = applyRmlTextCorrection(
      RML,
      [statement],
      [
        `${statement.replace('"person".', '"person";\n    rr:predicateObjectMap :pom_new.')}
:pom_new rr:predicateMap :pm_new; rr:objectMap :om_new.
:pm_new rr:constant foaf:givenName.
:om_new rml:reference "first_name".`,
      ],
    );
    expect(objectsOf(patched, `${M}map_person_000`, `${RR}predicateObjectMap`).sort()).toEqual([
      `${M}pom_001`,
      `${M}pom_new`,
    ]);
  });

  test('delete_property (empty correction) removes the whole node and links to it', () => {
    const patched = applyRmlTextCorrection(RML, [':pom_001 rr:predicateMap :pm_001.'], ['']);

    expect(objectsOf(patched, `${M}pom_001`, `${RR}objectMap`)).toEqual([]);
    expect(objectsOf(patched, `${M}map_person_000`, `${RR}predicateObjectMap`)).toEqual([]);
  });
});

describe('groupRmlBySubject', () => {
  test('puts every triple about a node into a single statement', () => {
    const grouped = groupRmlBySubject(RML);
    const statementsAboutMap = grouped.match(/^:map_person_000\s/gm) ?? [];

    expect(statementsAboutMap).toHaveLength(1);
    const block = grouped.slice(grouped.indexOf(':map_person_000 '));
    const end = block.indexOf('.\n');
    expect(block.slice(0, end)).toContain('rr:subjectMap');
    expect(block.slice(0, end)).toContain('rr:predicateObjectMap');
  });

  test('is lossless', () => {
    const parse = (ttl: string) => new Parser({ format: 'text/turtle' }).parse(ttl);
    expect(new Store(parse(groupRmlBySubject(RML))).size).toBe(new Store(parse(RML)).size);
  });
});
