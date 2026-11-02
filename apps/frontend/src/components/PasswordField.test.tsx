import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PasswordField } from './PasswordField'

describe('PasswordField', () => {
  it('starts hidden and toggles the visibility with a pressed state', async () => {
    render(<PasswordField id="pwd" label="Senha" />)
    const input = screen.getByLabelText('Senha')
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })

    expect(input).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(toggle)

    expect(input).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(toggle)

    expect(input).toHaveAttribute('type', 'password')
  })

  it('warns while Caps Lock is on and links the warning to the input', () => {
    render(<PasswordField id="pwd" label="Senha" />)
    const input = screen.getByLabelText('Senha')

    fireEvent.keyUp(input, { key: 'A', modifierCapsLock: true })

    expect(screen.getByRole('status')).toHaveTextContent('Caps Lock está ativado.')
    expect(input).toHaveAttribute('aria-describedby', 'pwd-caps-lock')

    fireEvent.keyDown(input, { key: 'a', modifierCapsLock: false })

    expect(screen.queryByText('Caps Lock está ativado.')).not.toBeInTheDocument()
  })

  it('hides the Caps Lock warning when the field loses focus', () => {
    render(<PasswordField id="pwd" label="Senha" />)
    const input = screen.getByLabelText('Senha')

    fireEvent.keyUp(input, { key: 'A', modifierCapsLock: true })
    fireEvent.blur(input)

    expect(screen.queryByText('Caps Lock está ativado.')).not.toBeInTheDocument()
  })

  it('keeps the handlers passed by the page', () => {
    const onKeyDown = vi.fn()
    const onKeyUp = vi.fn()
    const onBlur = vi.fn()
    render(<PasswordField id="pwd" label="Senha" onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={onBlur} />)
    const input = screen.getByLabelText('Senha')

    fireEvent.keyDown(input, { key: 'a' })
    fireEvent.keyUp(input, { key: 'a' })
    fireEvent.blur(input)

    expect(onKeyDown).toHaveBeenCalled()
    expect(onKeyUp).toHaveBeenCalled()
    expect(onBlur).toHaveBeenCalled()
  })

  it('renders the hint, the icon and the action next to the label', () => {
    render(<PasswordField id="pwd" label="Senha" icon="lock" hint="Use a senha temporária." action={<button type="button">Ajuda</button>} />)

    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-describedby', 'pwd-hint')
    expect(screen.getByText('Use a senha temporária.')).toHaveAttribute('id', 'pwd-hint')
    expect(screen.getByRole('button', { name: 'Ajuda' })).toBeInTheDocument()
    expect(screen.getByLabelText('Senha').closest('.input-wrap')).toHaveClass('has-icon')
  })
})
