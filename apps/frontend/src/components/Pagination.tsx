export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  return <nav aria-label="Paginação"><button disabled={page === 1} onClick={() => onChange(page - 1)}>Anterior</button><span>Página {page} de {totalPages}</span><button disabled={page === totalPages} onClick={() => onChange(page + 1)}>Próxima</button></nav>
}