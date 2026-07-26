import type { CityData } from '../engine/types';
import { inkFor } from '../lib/format';

interface Props {
  cities: CityData[];
  selectedIds: ReadonlySet<string>;
  homeCityId: string;
  onToggle: (cityId: string) => void;
}

/**
 * Which cities show up in the comparison. The home city's chip is pinned
 * rather than clickable — there's nothing to compare against without it —
 * every other city is a plain on/off toggle. New cities added to the data
 * set show up here unselected, since `selectedCityIds` names a fixed
 * default rather than "everything in `CITIES`".
 */
export function CitySelector({ cities, selectedIds, homeCityId, onToggle }: Props) {
  return (
    <div role="group" aria-label="Cities to compare" className="flex flex-wrap gap-1.5">
      {cities.map((city) => {
        const isHome = city.id === homeCityId;
        const selected = isHome || selectedIds.has(city.id);
        const cityInk = inkFor(city.currency);
        return (
          <button
            key={city.id}
            type="button"
            aria-pressed={selected}
            disabled={isHome}
            onClick={() => onToggle(city.id)}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11.5px] transition-colors ${
              selected
                ? 'border-line bg-plate text-ink'
                : 'border-line/60 text-faint hover:text-muted'
            } ${isHome ? 'cursor-default' : ''}`}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: cityInk, opacity: selected ? 1 : 0.35 }}
            />
            {city.name}
            {isHome && <span className="text-faint">· home</span>}
          </button>
        );
      })}
    </div>
  );
}
