<script lang="ts">
  import { elementOptionsForRow } from "../core/searchSpace";
  import { formatIsotopeOption } from "../core/massData";
  import type { FormulaSpaceRow, MassIndex } from "../core/types";

  export let rows: FormulaSpaceRow[] = [];
  export let massIndex: MassIndex;
  export let disabled = false;
  export let onAddRow: () => void;
  export let onRemoveRow: (rowId: number) => void;
  export let onUpdateRow: (rowId: number, patch: Partial<FormulaSpaceRow>) => void;

  $: canAddRow = elementOptionsForRow(rows, massIndex, null).length > 0;
</script>

<section class="ui-card" aria-label="Formula search space">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="mt-0">Formula search space</h2>
      <p class="-mt-1.5 text-muted">Use one row per isotope-specific species. Repeated elements are allowed when different isotopes are selected.</p>
    </div>
  </div>

  <div class="w-full overflow-x-auto">
    <table class="w-full border-collapse">
      <thead>
        <tr>
          <th class="formula-table-head min-w-[130px]">Element</th>
          <th class="formula-table-head min-w-[180px]">Isotope</th>
          <th class="formula-table-head min-w-[140px]">Lower limit</th>
          <th class="formula-table-head min-w-[140px]">Upper limit</th>
          <th class="formula-table-head w-[58px] text-right" aria-label="Remove row"></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr>
            <td class="formula-table-cell min-w-[130px]">
              <select
                class="field-control"
                value={row.element}
                disabled={disabled}
                aria-label="Element"
                on:change={(event) => onUpdateRow(row.id, { element: (event.currentTarget as HTMLSelectElement).value })}
              >
                {#each elementOptionsForRow(rows, massIndex, row.id) as symbol}
                  <option value={symbol}>{symbol}</option>
                {/each}
              </select>
            </td>
            <td class="formula-table-cell min-w-[180px]">
              <select
                class="field-control"
                value={row.isotope}
                disabled={disabled}
                aria-label="Isotope"
                on:change={(event) => onUpdateRow(row.id, { isotope: (event.currentTarget as HTMLSelectElement).value })}
              >
                {#each massIndex.isotopeOptions[row.element] || [] as isotope}
                  <option value={isotope}>{formatIsotopeOption(massIndex, isotope)}</option>
                {/each}
              </select>
            </td>
            <td class="formula-table-cell min-w-[140px]">
              <input
                class="field-control"
                type="number"
                min="0"
                step="1"
                value={row.lower}
                disabled={disabled}
                aria-label="Lower limit"
                on:input={(event) => {
                  const value = (event.currentTarget as HTMLInputElement).value;
                  onUpdateRow(row.id, { lower: value === "" ? "" : Number(value) });
                }}
              />
            </td>
            <td class="formula-table-cell min-w-[140px]">
              <input
                class="field-control"
                type="number"
                min="0"
                step="1"
                value={row.upper}
                disabled={disabled}
                aria-label="Upper limit"
                on:input={(event) => {
                  const value = (event.currentTarget as HTMLInputElement).value;
                  onUpdateRow(row.id, { upper: value === "" ? "" : Number(value) });
                }}
              />
            </td>
            <td class="formula-table-cell w-[58px] text-right">
              <button
                type="button"
                class="danger-icon-action"
                title="Remove row"
                disabled={disabled || rows.length <= 1}
                on:click={() => onRemoveRow(row.id)}
              >
                <span class="i-mdi-minus h-[18px] w-[18px]" aria-hidden="true"></span>
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="mt-2.5 flex justify-start">
    <button id="addRow" type="button" class="icon-action" title="Add row" disabled={disabled || !canAddRow} on:click={onAddRow}>
      <span class="i-mdi-add h-[18px] w-[18px]" aria-hidden="true"></span>
    </button>
  </div>
</section>
