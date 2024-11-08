'use client';

import { OntologyClassDocument } from '@/lib/models/OntologyIndexModel';
import { ChevronRight, ExpandMore } from '@mui/icons-material';
import { Box, Divider, TextField, Typography } from '@mui/material';
import { TreeItem, TreeView } from '@mui/x-tree-view';
import { useState } from 'react';

const OntologyClassTab = ({
  open,
  classes,
  class_domains,
  class_ranges,
  selected,
  goToProperty,
}: {
  open: boolean;
  classes: OntologyClassDocument[];
  class_domains: { [key: string]: string[] };
  class_ranges: { [key: string]: string[] };
  selected: string;
  goToProperty: (uri: string) => void;
}) => {
  const [search, setSearch] = useState('');

  const [expanded, setExpanded] = useState<string[]>([]);

  const filteredClasses = classes.filter(c => {
    if (search === '') return true;
    return (
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.full_uri.toLowerCase().includes(search.toLowerCase()) ||
      class_domains[c.full_uri]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      class_ranges[c.full_uri]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  // With tree view
  return (
    <Box
      style={{
        display: open ? 'block' : 'none',
        margin: '10px',
      }}
    >
      <TextField
        label='Search'
        value={search}
        onChange={e => setSearch(e.target.value)}
      ></TextField>
      <Divider
        sx={{
          margin: '10px 0',
        }}
      />
      <TreeView
        defaultCollapseIcon={<ExpandMore />}
        defaultExpandIcon={<ChevronRight />}
        expanded={expanded}
        selected={[selected]}
        onNodeToggle={(event, nodes) => {
          setExpanded(nodes);
        }}
        multiSelect
      >
        {filteredClasses.length === 0 && (
          <TreeItem nodeId='empty' label='No classes found' />
        )}
        {filteredClasses.map(c => (
          <TreeItem
            key={c.full_uri}
            nodeId={c.full_uri}
            id={c.full_uri}
            label={
              <Typography
                sx={{
                  textDecoration: c.is_deprecated ? 'line-through' : 'none',
                }}
              >
                {c.label}
              </Typography>
            }
          >
            <Box>
              <Typography>
                <strong>URI: </strong>
                {c.full_uri}
              </Typography>

              <Typography>
                <strong>Description: </strong>
                {c.description}
              </Typography>
              <TreeItem
                key={c.full_uri + '-domain'}
                nodeId={c.full_uri + '-domain'}
                label={
                  class_domains[c.full_uri].length === 0
                    ? 'Domains - Not found'
                    : 'Domains'
                }
              >
                {class_domains[c.full_uri].map(d => (
                  <TreeItem
                    key={c.full_uri + '-domain-' + d}
                    nodeId={c.full_uri + '-domain-' + d}
                    label={d}
                    onClick={() => {
                      goToProperty(d);
                    }}
                  />
                ))}
              </TreeItem>
              <TreeItem
                key={c.full_uri + '-range'}
                nodeId={c.full_uri + '-range'}
                label={
                  class_ranges[c.full_uri].length === 0
                    ? 'Ranges - Not found'
                    : 'Ranges'
                }
              >
                {class_ranges[c.full_uri].map(r => (
                  <TreeItem
                    key={c.full_uri + '-range-' + r}
                    nodeId={c.full_uri + '-range-' + r}
                    label={r}
                    onClick={() => {
                      goToProperty(c.full_uri);
                    }}
                  />
                ))}
              </TreeItem>
            </Box>
          </TreeItem>
        ))}
      </TreeView>
    </Box>
  );
};

export default OntologyClassTab;
