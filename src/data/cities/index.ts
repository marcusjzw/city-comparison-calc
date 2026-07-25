import type { CityData } from '../../engine/types';
import sanFrancisco from './san-francisco.json';
import singapore from './singapore.json';
import sydney from './sydney.json';

/**
 * Every city is a JSON record conforming to one schema. Adding Lisbon, Dubai,
 * London or Austin is a data task: drop a file in this directory and add it to
 * the array. There is deliberately no per-city code anywhere in this app.
 *
 * The casts are the one place raw JSON meets the type system. `validateCity`
 * covers the rest, and runs over every record in the test suite.
 */
export const CITIES: CityData[] = [
  sydney as unknown as CityData,
  singapore as unknown as CityData,
  sanFrancisco as unknown as CityData,
];

export function cityById(id: string): CityData {
  const city = CITIES.find((c) => c.id === id);
  if (!city) throw new Error(`Unknown city "${id}"`);
  return city;
}
