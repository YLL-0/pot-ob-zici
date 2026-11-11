# Logotipi financerjev (noga strani)

Noga strani (`components/Noga.tsx`) pričakuje te štiri datoteke, v tem vrstnem redu od leve proti desni:

| Datoteka | Logotip |
|---|---|
| `zzb-nob-nm.svg` | ZZB NOB Novo mesto (Združenje borcev za vrednote NOB Novo mesto) |
| `cnvos.svg` | CNVOS |
| `4impact-values.svg` | 4IMPACT VALUES |
| `eu-sofinancira.svg` | Emblem EU z napisom »Sofinancira Evropska unija« |

Datoteke dostavi naročnik. Logotipov ne rišemo, ne prerisujemo in jih ne nadomeščamo z besedilom.
Dokler datoteke ni, je na njenem mestu nevtralen prazen okvir.

- Format: SVG z atributom `viewBox`. Iz njega se izračuna razmerje stranic, zato se logotip ne popači.
- Višina v nogi je 40 px, širina sledi razmerju.
- Emblema EU ni dovoljeno prebarvati ali obrezati. Uporabi uradno datoteko, kot je.

Ko datoteko dodaš sem, se pri naslednji gradnji (`npm run build`) prikaže sama. Kode ni treba spreminjati.
