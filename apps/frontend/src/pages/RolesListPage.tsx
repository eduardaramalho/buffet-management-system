import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRoles } from '../api/rolesApi'
import { Table } from '../components/Table'
import type { Role } from '../types'

export function RolesListPage() { const [roles, setRoles] = useState<Role[]>([]); useEffect(() => { void listRoles().then(setRoles) }, []); return <main className="app-shell"><header><div><span className="eyebrow">CONTROLE DE ACESSO</span><h1>Papéis</h1></div><Link className="secondary" to="/roles/new">Novo papel</Link></header><Table headers={['Nome', 'Descrição']}>{roles.map((role) => <tr key={role.id}><td><Link to={`/roles/${role.id}`}>{role.name}</Link></td><td>{role.description}</td></tr>)}</Table></main> }