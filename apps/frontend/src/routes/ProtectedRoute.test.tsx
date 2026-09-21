import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthProvider } from '../contexts/AuthContext'

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    render(<MemoryRouter initialEntries={['/users']}><AuthProvider><ProtectedRoute><span>private content</span></ProtectedRoute></AuthProvider></MemoryRouter>)

    expect(screen.queryByText('private content')).not.toBeInTheDocument()
  })
})