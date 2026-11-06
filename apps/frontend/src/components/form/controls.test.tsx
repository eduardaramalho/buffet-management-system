import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChoiceCard } from './ChoiceCard'
import { FieldGroup } from './FieldGroup'
import { MaskedField } from './MaskedField'
import { PasswordField } from './PasswordField'
import { SegmentedControl } from './SegmentedControl'
import { Switch } from './Switch'
import { SelectField, TextAreaField, TextField } from './TextField'
import { maskPhone } from '../../utils/masks'

describe('form controls', () => {
  it('links the label, hint and error to the control', () => {
    render(<TextField label="Nome" required hint="Como aparece na lista" error="Informe o nome." aside="0/10" />)

    const input = screen.getByLabelText('Nome')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Informe o nome. Como aparece na lista')
    expect(screen.getByText('0/10')).toBeInTheDocument()
  })

  it('renders select and textarea fields with the same structure', () => {
    render(<><SelectField label="Tipo"><option>A</option></SelectField><TextAreaField label="Notas" optional /></>)
    expect(screen.getByLabelText('Tipo').tagName).toBe('SELECT')
    expect(screen.getByLabelText('Notas').tagName).toBe('TEXTAREA')
  })

  it('applies the mask on every change', () => {
    function Phone() { const [value, setValue] = useState(''); return <MaskedField label="Telefone" value={value} mask={maskPhone} onValueChange={setValue} /> }
    render(<Phone />)
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '47999990000' } })
    expect(screen.getByLabelText('Telefone')).toHaveValue('(47) 99999-0000')
  })

  it('shows and hides the password', () => {
    render(<PasswordField label="Senha" />)
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    fireEvent.click(toggle)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('groups options under a legend with its error', () => {
    render(<FieldGroup label="Papel" required error="Selecione o papel." hint="Ajuda"><ChoiceCard type="radio" name="r" title="Gestor" description="Tudo" checked onChange={vi.fn()} /></FieldGroup>)
    expect(screen.getByRole('group', { name: 'Papel' })).toHaveAccessibleDescription('Selecione o papel. Ajuda')
    expect(screen.getByRole('radio', { name: 'Gestor' })).toBeChecked()
  })

  it('switches segments and toggles the switch', () => {
    const onSegment = vi.fn()
    const onSwitch = vi.fn()
    render(<>
      <SegmentedControl label="Tipo" value="a" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} onChange={onSegment} />
      <Switch label="Ativo" description="Explicação" checked onChange={onSwitch} />
    </>)
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onSegment).toHaveBeenCalledWith('b')
    fireEvent.click(screen.getByRole('switch', { name: /Ativo/ }))
    expect(onSwitch).toHaveBeenCalledWith(false)
  })
})
