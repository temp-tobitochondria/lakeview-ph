<?php

namespace App\Support;

/**
 * SearchSynonyms - Handles synonym normalization for search queries
 * 
 * This class provides synonym mapping to ensure that semantically similar
 * search terms produce the same results. For example:
 * 
 * - "biggest lake" → "largest lake"
 * - "tiniest lake" → "smallest lake"
 * - "hugest lake" → "largest lake"
 * 
 * Usage:
 * - SearchSynonyms::normalize($query) - Normalizes query by replacing synonyms
 * - SearchSynonyms::containsAny($query, $synonyms) - Check if query contains any synonym
 * - SearchSynonyms::getSynonyms($word) - Get all synonyms for a word
 * 
 * @package App\Support
 */
class SearchSynonyms
{
    /**
     * Synonym groups - words in the same group are treated as equivalents
     */
    private static array $synonymGroups = [
        // Size - large
        ['largest', 'biggest', 'greatest', 'hugest', 'vastest', 'top'],
        
        // Size - small
        ['smallest', 'tiniest', 'littlest', 'minutest'],
        
        // Depth
        ['deepest', 'profoundest'],
        ['shallowest'],
        
        // Height/Elevation
        ['highest', 'tallest', 'loftiest'],
        ['lowest'],
        
        // Length
        ['longest'],
        ['shortest'],
        
        // Temperature
        ['hottest', 'warmest'],
        ['coldest', 'coolest', 'chilliest'],
        
        // Quality descriptors
        ['cleanest', 'purest', 'clearest', 'pristine'],
        ['dirtiest', 'muddiest', 'cloudiest', 'polluted'],
        
        // Age
        ['oldest', 'most ancient'],
        ['newest', 'youngest', 'most recent'],
        
        // Water characteristics
        ['clearest', 'most transparent'],
        ['murkiest', 'most turbid'],
        
        // Geographic terms
        ['lake', 'lakes', 'laguna', 'danao'],
        ['river', 'rivers', 'ilog'],
        ['mountain', 'mountains', 'bundok'],
        ['island', 'islands', 'isla', 'pulo'],
        
        // Regions (Philippines)
        ['region', 'regions', 'rehiyon'],
        ['province', 'provinces', 'probinsya'],
        ['municipality', 'municipalities', 'munisipyo', 'bayan'],
        ['city', 'cities', 'siyudad', 'lungsod'],
    ];

    /**
     * Normalize a query by replacing synonyms with a canonical form
     * 
     * @param string $query
     * @return string
     */
    public static function normalize(string $query): string
    {
        $normalized = strtolower(trim($query));
        
        foreach (self::$synonymGroups as $group) {
            // Use the first word in each group as the canonical form
            $canonical = $group[0];
            
            foreach ($group as $synonym) {
                // Replace whole words only (using word boundaries)
                $normalized = preg_replace(
                    '/\b' . preg_quote($synonym, '/') . '\b/i',
                    $canonical,
                    $normalized
                );
            }
        }
        
        return $normalized;
    }

    /**
     * Check if query contains any synonym from a group
     * 
     * @param string $query
     * @param array $synonyms
     * @return bool
     */
    public static function containsAny(string $query, array $synonyms): bool
    {
        $queryLower = strtolower($query);
        
        foreach ($synonyms as $synonym) {
            if (preg_match('/\b' . preg_quote($synonym, '/') . '\b/i', $queryLower)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get all synonyms for a given word
     * 
     * @param string $word
     * @return array
     */
    public static function getSynonyms(string $word): array
    {
        $wordLower = strtolower(trim($word));
        
        foreach (self::$synonymGroups as $group) {
            if (in_array($wordLower, $group, true)) {
                return $group;
            }
        }
        
        return [$word];
    }

    /**
     * Get canonical form for a word (first synonym in its group)
     * 
     * @param string $word
     * @return string
     */
    public static function getCanonical(string $word): string
    {
        $wordLower = strtolower(trim($word));
        
        foreach (self::$synonymGroups as $group) {
            if (in_array($wordLower, $group, true)) {
                return $group[0];
            }
        }
        
        return $wordLower;
    }

    /**
     * Get all size-related synonyms (large)
     * 
     * @return array
     */
    public static function getLargeSynonyms(): array
    {
        return ['largest', 'biggest', 'greatest', 'hugest', 'vastest', 'top'];
    }

    /**
     * Get all size-related synonyms (small)
     * 
     * @return array
     */
    public static function getSmallSynonyms(): array
    {
        return ['smallest', 'tiniest', 'littlest', 'minutest'];
    }

    /**
     * Get all depth-related synonyms (deep)
     * 
     * @return array
     */
    public static function getDeepSynonyms(): array
    {
        return ['deepest', 'profoundest'];
    }

    /**
     * Get all height-related synonyms (high)
     * 
     * @return array
     */
    public static function getHighSynonyms(): array
    {
        return ['highest', 'tallest', 'loftiest'];
    }

    /**
     * Get all height-related synonyms (low)
     * 
     * @return array
     */
    public static function getLowSynonyms(): array
    {
        return ['lowest'];
    }

    /**
     * Get all length-related synonyms (long)
     * 
     * @return array
     */
    public static function getLongSynonyms(): array
    {
        return ['longest'];
    }

    /**
     * Debug: Show how a query would be normalized
     * Returns an array with original and normalized versions
     * 
     * @param string $query
     * @return array
     */
    public static function debug(string $query): array
    {
        $normalized = self::normalize($query);
        $changes = [];
        
        foreach (self::$synonymGroups as $group) {
            $canonical = $group[0];
            foreach ($group as $synonym) {
                if ($synonym !== $canonical && stripos($query, $synonym) !== false) {
                    $changes[] = "$synonym → $canonical";
                }
            }
        }
        
        return [
            'original' => $query,
            'normalized' => $normalized,
            'changes' => $changes,
            'changed' => $query !== $normalized,
        ];
    }
}
