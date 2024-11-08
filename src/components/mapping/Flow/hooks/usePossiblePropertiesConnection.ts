'use client';
import { OntologyPropertyDocument } from '@/lib/models/OntologyIndexModel';
import { useMemo } from 'react';

const usePossiblePropertiesConnection = (
  source: string | null,
  target: string | null,
  properties: OntologyPropertyDocument[],
) => {
  return useMemo(() => {
    if (!source && !target) {
      return [];
    }

    if (!source) {
      return properties.filter(property =>
        property.property_range.find(
          target === null ? () => true : range => range === target,
        ),
      );
    }

    return properties.filter(property => {
      const sourceConstraint = property.property_domain.find(
        domain => domain === source,
      );
      const targetConstraint = property.property_range.find(
        target === null ? () => true : range => range === target,
      );
      const deprecated = property.is_deprecated;
      return sourceConstraint && targetConstraint && !deprecated;
    });
  }, [source, target, properties]);
};

export default usePossiblePropertiesConnection;
