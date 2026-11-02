import { daysFromNow } from './dates'

// Dados fixos e legíveis: o banco é recriado a cada execução, então não há colisão entre rodadas.
export const data = {
  // newPassword: definida pela gestora depois que o administrador redefine a senha (ADR 0012).
  manager: { name: 'Gestora E2E', email: 'gestora.e2e@buffet.local', password: 'Gestora123!', newPassword: 'GestoraNova456!', role: 'gestor' },
  client: { name: 'Mariana Souza', email: 'mariana.souza@example.com', phone: '(47) 99999-0000' },
  service: 'Buffet completo',
  // RF06: created, renamed and soft-deleted; it must stop being offered in new events.
  retiredService: { name: 'Decoração floral', renamed: 'Decoração com flores' },
  kitchenTeam: { name: 'Cozinha Central', specialty: 'Cozinha', collaborator: { name: 'Carlos Lima', position: 'Chef' } },
  // Inactivated in the UI: an inactive team keeps its history but cannot be assigned to events.
  supportTeam: { name: 'Equipe de Apoio', specialty: 'LIMPEZA' },
  rule: {
    name: 'Casamento grande',
    eventType: 'Casamento',
    minGuests: 100,
    tasks: [{ title: 'Preparar cardápio', daysBefore: 5 }, { title: 'Montar salão', daysBefore: 2 }],
    specialty: 'Cozinha',
  },
  event: { name: 'Casamento Mariana e João', location: 'Salão Jardim', type: 'Casamento', guests: 150, date: daysFromNow(10) },
  conflictingEvent: { name: 'Aniversário no mesmo dia', location: 'Salão Azul', guests: 60 },
  manualTask: { title: 'Confirmar fornecedor de flores' },
  // RF25: new event built from the concluded one (same couple's buffet, another date and guest count).
  replica: { name: 'Casamento Beatriz e Pedro', guests: 120, date: daysFromNow(20) },
}
