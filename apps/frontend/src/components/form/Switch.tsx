type SwitchProps = { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }

/** Liga/desliga com role="switch": o estado é anunciado como ativado ou desativado. */
export function Switch({ label, description, checked, onChange, disabled }: SwitchProps) {
  return <label className="fm-switch">
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span className="fm-switch-track" aria-hidden="true" />
    <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
  </label>
}
