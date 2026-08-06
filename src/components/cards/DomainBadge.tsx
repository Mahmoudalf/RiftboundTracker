import { StyleSheet, Text, View } from 'react-native';

import { domainColor, sortDomains } from '@/theme/domains';
import { radius, space } from '@/theme/tokens';
import { text } from '@/theme/typography';

import { DomainGlyph } from './DomainGlyph';

interface DomainBadgeProps {
  domains: readonly string[];
  size?: 'sm' | 'md';
  /** Show the domain name next to the glyph. */
  showLabel?: boolean;
}

/**
 * Domain indicator.
 *
 * Always renders the glyph, never color alone — required for colorblind users,
 * and the only thing that separates Fury (27°) from Body (40°) at a glance.
 */
export function DomainBadge({ domains, size = 'sm', showLabel = false }: DomainBadgeProps) {
  const resolved = sortDomains(domains);
  if (resolved.length === 0) return null;

  const dimension = size === 'sm' ? 18 : 24;

  return (
    <View
      style={styles.row}
      accessibilityLabel={`Domains: ${resolved.join(', ')}`}
      accessible
    >
      {resolved.map((domain) => {
        const c = domainColor(domain);
        return (
          <View key={domain} style={styles.item}>
            <View
              style={[
                styles.glyphWrap,
                {
                  width: dimension,
                  height: dimension,
                  borderRadius: radius.full,
                  backgroundColor: c.dim,
                },
              ]}
            >
              <DomainGlyph domain={domain} size={size === 'sm' ? 10 : 13} color={c.base} />
            </View>
            {showLabel ? (
              <Text style={[styles.label, { color: c.base }]}>{domain}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  glyphWrap: { alignItems: 'center', justifyContent: 'center' },
  glyph: { lineHeight: 16, textAlign: 'center' },
  label: { ...text.microMeta },
});
