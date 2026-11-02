import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthLayout } from './AuthLayout'
import { FormField } from './FormField'
import { Notice } from './Notice'

describe('AuthLayout', () => {
  it('shows the brand panel and the page content without the internal navigation', () => {
    render(<AuthLayout title="Organize. Planeje. Execute." description="Texto de apoio." aside={<p>Destaques</p>}><h1>Acesse sua conta</h1></AuthLayout>)

    expect(screen.getByText('Eventos')).toBeInTheDocument()
    expect(screen.getByText('Organize. Planeje. Execute.')).toBeInTheDocument()
    expect(screen.getByText('Texto de apoio.')).toBeInTheDocument()
    expect(screen.getByText('Destaques')).toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Acesse sua conta' }))
    expect(screen.getByText(`© ${new Date().getFullYear()} EventosPro`)).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('FormField', () => {
  it('keeps the plain markup when there is no icon', () => {
    render(<FormField label="Nome" />)

    expect(screen.getByLabelText('Nome').closest('.input-wrap')).toBeNull()
  })

  it('places a decorative icon inside the field', () => {
    render(<FormField label="E-mail" icon="mail" />)

    expect(screen.getByLabelText('E-mail').closest('.input-wrap')).toHaveClass('has-icon')
  })
})

describe('Notice', () => {
  it('announces errors and warnings as alerts and success as status', () => {
    const { rerender } = render(<Notice message="Falhou" error />)
    expect(screen.getByRole('alert')).toHaveClass('alert', 'error')

    rerender(<Notice message="Atenção" warning />)
    expect(screen.getByRole('alert')).toHaveClass('alert', 'warning')

    rerender(<Notice message="Salvo" />)
    expect(screen.getByRole('status')).toHaveClass('alert')
  })
})
