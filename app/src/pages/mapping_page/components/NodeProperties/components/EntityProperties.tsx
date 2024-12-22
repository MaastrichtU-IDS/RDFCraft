import GroupedSelectRenderer from '@/components/GroupedSelectRenderer';
import OneLineMonaco from '@/components/OneLineMonacoEditor';
import toast from '@/consts/toast';
import {
  NamedNode,
  OntologyClass,
  Property,
} from '@/lib/api/ontology_api/types';
import { EntityNodeType } from '@/pages/mapping_page/components/MainPanel/types';
import useClassOrderer from '@/pages/mapping_page/hooks/useClassOrderer';
import useDomainOrderer from '@/pages/mapping_page/hooks/useDomainOrderer';
import useMappingPage from '@/pages/mapping_page/state';
import { FormGroup, H5, InputGroup, MenuItem } from '@blueprintjs/core';
import { ItemListRendererProps, MultiSelect } from '@blueprintjs/select';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useMemo } from 'react';

import './styles.scss';

const EntityNodeProperties = ({ node }: { node: EntityNodeType }) => {
  const ontologies = useMappingPage(state => state.ontologies);
  const reactflow = useReactFlow();

  const properties = useMemo<(Property & { group: string })[]>(
    () =>
      node.data.properties
        .map(
          uri =>
            ontologies
              ?.flatMap(o => o.properties)
              .find(p => p.full_uri === uri) ||
            ({
              type: 'property',
              full_uri: uri,
              label: [{ value: uri }],
              belongs_to: 'Created',
              property_type: 'any',
              domain: [],
              range: [],
              description: [],
              is_deprecated: false,
            } as Property),
        )
        .map(p => ({ ...p, group: p.belongs_to })),
    [node.data.properties, ontologies],
  );

  const rdfType = useMemo<(OntologyClass & { group: string })[]>(
    () =>
      node.data.rdf_type
        .map(
          uri =>
            ontologies?.flatMap(o => o.classes).find(c => c.full_uri === uri) ||
            ({
              full_uri: uri,
              label: [{ value: uri }],
              belongs_to: 'Created',
              super_classes: [],
              type: 'class',
              description: [],
              is_deprecated: false,
            } as OntologyClass),
        )
        .map(c => ({ ...c, group: c.belongs_to })),
    [node.data.rdf_type, ontologies],
  );

  const possibleClasses = useClassOrderer(node);
  const possibleProperties = useDomainOrderer(node);

  const updateNode = useCallback(
    (
      label: string | null,
      uriPattern: string | null,
      rdfType: (OntologyClass & { group: string })[] | null,
      properties: (Property & { group: string })[] | null,
    ) => {
      reactflow.updateNode(node.id, {
        data: {
          ...node.data,
          label: label ?? node.data.label,
          uri_pattern: uriPattern ?? node.data.uri_pattern,
          rdf_type: rdfType?.map(c => c.full_uri) ?? node.data.rdf_type,
          properties: properties?.map(p => p.full_uri) ?? node.data.properties,
        },
      });
    },
    [node, reactflow],
  );

  const createNewClassItemFromQuery = (query: string) => {
    return {
      full_uri: query,
      label: [{ value: query }],
      belongs_to: '',
      super_classes: [],
      type: 'class',
      group: 'Create',
      description: [],
      is_deprecated: false,
    } as OntologyClass & { group: string };
  };

  const createNewPropertyItemFromQuery = (query: string) => {
    return {
      full_uri: query,
      label: [{ value: query }],
      belongs_to: '',
      property_type: 'any',
      domain: [],
      range: [],
      type: 'property',
      group: 'Create',
      description: [],
      is_deprecated: false,
    } as Property & { group: string };
  };

  const itemSearch = (query: string, item: NamedNode & { group: string }) => {
    if (item.label.length > 0) {
      return item.label[0].value.toLowerCase().includes(query.toLowerCase());
    }
    return item.full_uri.toLowerCase().includes(query.toLowerCase());
  };

  const createNewItemRenderer = (
    query: string,
    active: boolean,
    handleClick: React.MouseEventHandler<HTMLElement>,
  ) => (
    <MenuItem
      key={query}
      text={`Create "${query}"`}
      onClick={(e: React.MouseEvent<HTMLElement>) => {
        try {
          new URL(query);
        } catch {
          toast.show({
            message: 'Invalid URI, please enter a valid URI',
            intent: 'danger',
          });
          return;
        }
        handleClick(e);
      }}
      active={active}
    />
  );

  const itemListRenderer = (
    props: ItemListRendererProps<NamedNode & { group: string }>,
  ) => {
    return (
      <GroupedSelectRenderer<NamedNode & { group: string }>
        listProps={props}
        initialContent={<MenuItem disabled text='No classes' />}
        noResults={<MenuItem disabled text='No results' />}
        getGroup={item => item.group}
      />
    );
  };

  const tagRenderer = (item: NamedNode & { group: string }) => {
    const ontology = ontologies?.find(o => o.base_uri === item.belongs_to);
    if (ontology && item.label.length > 0) {
      return `${ontology.name}:${item.label[0].value}`;
    }
    if (item.label.length > 0) {
      return item.label[0].value;
    }
    return item.full_uri;
  };

  return (
    <>
      <H5>Entity Node</H5>
      <FormGroup label='Label' labelFor='label'>
        <InputGroup
          id='label'
          value={node.data.label}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            updateNode(e.target.value, null, null, null)
          }
        />
      </FormGroup>
      <FormGroup label='RDF Types' labelFor='rdfType'>
        <MultiSelect<NamedNode & { group: string }>
          fill
          popoverProps={{
            matchTargetWidth: true,
            popoverClassName: 'popover-scroll',
          }}
          onRemove={item =>
            updateNode(
              null,
              null,
              rdfType.filter(c => c !== item),
              null,
            )
          }
          itemRenderer={(item, { handleClick, modifiers }) => (
            <MenuItem
              role='menuitem'
              key={item.full_uri}
              label='Class'
              text={item.label.length > 0 ? item.label[0].value : item.full_uri}
              onClick={handleClick}
              active={modifiers.active}
            />
          )}
          itemPredicate={itemSearch}
          items={possibleClasses.classes.filter(
            c => !rdfType.some(r => r.full_uri === c.full_uri),
          )}
          onItemSelect={item => {
            try {
              new URL(item.full_uri);
            } catch {
              toast.show({
                message: 'Invalid URI, please enter a valid URI',
                intent: 'danger',
              });
              return;
            }
            if (!rdfType.some(c => c.full_uri === item.full_uri)) {
              updateNode(
                null,
                null,
                [...rdfType, item as OntologyClass & { group: string }],
                null,
              );
            }
          }}
          selectedItems={rdfType}
          itemListRenderer={itemListRenderer}
          tagRenderer={tagRenderer}
          createNewItemFromQuery={createNewClassItemFromQuery}
          createNewItemRenderer={createNewItemRenderer}
          itemsEqual={(a, b) => a.full_uri === b.full_uri}
          resetOnQuery
          resetOnSelect
        />
      </FormGroup>
      <FormGroup label='Properties' labelFor='properties'>
        <MultiSelect<NamedNode & { group: string }>
          fill
          popoverProps={{
            matchTargetWidth: true,
            popoverClassName: 'popover-scroll',
          }}
          onRemove={item =>
            updateNode(
              null,
              null,
              null,
              properties.filter(p => p !== item),
            )
          }
          itemRenderer={(item, { handleClick, modifiers }) => (
            <MenuItem
              role='menuitem'
              key={item.full_uri}
              label='Property'
              text={item.label.length > 0 ? item.label[0].value : item.full_uri}
              onClick={handleClick}
              active={modifiers.active}
            />
          )}
          itemPredicate={itemSearch}
          items={possibleProperties.filter(
            p => !properties.some(prop => prop.full_uri === p.full_uri),
          )}
          onItemSelect={item => {
            try {
              new URL(item.full_uri);
            } catch {
              toast.show({
                message: 'Invalid URI, please enter a valid URI',
                intent: 'danger',
              });
              return;
            }
            if (!properties.some(p => p.full_uri === item.full_uri)) {
              updateNode(null, null, null, [
                ...properties,
                item as Property & { group: string },
              ]);
            }
          }}
          selectedItems={properties}
          itemListRenderer={itemListRenderer}
          tagRenderer={tagRenderer}
          createNewItemFromQuery={createNewPropertyItemFromQuery}
          createNewItemRenderer={createNewItemRenderer}
          itemsEqual={(a, b) => a.full_uri === b.full_uri}
          resetOnQuery
          resetOnSelect
        />
      </FormGroup>
      <FormGroup label='URI Pattern' labelFor='uriPattern'>
        <OneLineMonaco
          onChange={(value: string | undefined) =>
            updateNode(null, value ?? '', null, null)
          }
          value={node.data.uri_pattern}
          language='mapping_language'
          theme='mapping-theme'
        />
      </FormGroup>
    </>
  );
};

export default EntityNodeProperties;
