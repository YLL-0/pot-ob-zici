import * as migration_20261120_125150_zacetna_shema from './20261120_125150_zacetna_shema';
import * as migration_20261122_161601_licenca_in_vir_fotografij from './20261122_161601_licenca_in_vir_fotografij';
import * as migration_20261122_194119_napis_obelezja from './20261122_194119_napis_obelezja';

export const migrations = [
  {
    up: migration_20261120_125150_zacetna_shema.up,
    down: migration_20261120_125150_zacetna_shema.down,
    name: '20261120_125150_zacetna_shema',
  },
  {
    up: migration_20261122_161601_licenca_in_vir_fotografij.up,
    down: migration_20261122_161601_licenca_in_vir_fotografij.down,
    name: '20261122_161601_licenca_in_vir_fotografij',
  },
  {
    up: migration_20261122_194119_napis_obelezja.up,
    down: migration_20261122_194119_napis_obelezja.down,
    name: '20261122_194119_napis_obelezja'
  },
];
