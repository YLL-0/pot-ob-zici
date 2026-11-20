import * as migration_20261120_125150_zacetna_shema from './20261120_125150_zacetna_shema';

export const migrations = [
  {
    up: migration_20261120_125150_zacetna_shema.up,
    down: migration_20261120_125150_zacetna_shema.down,
    name: '20261120_125150_zacetna_shema'
  },
];
