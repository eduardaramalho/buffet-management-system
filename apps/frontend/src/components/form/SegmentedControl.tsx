type Option<T extends string> = { value: T; label: string }
type SegmentedControlProps<T extends string> = { label: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void }

/** Alternância entre poucas opções exclusivas (por exemplo, pessoa física ou jurídica). */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return <div className="fm-segmented" role="group" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" className={option.value === value ? 'on' : ''} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
}
