import { daysFromNow } from './dates'

// Dados fixos e legíveis: o banco é recriado a cada execução, então não há colisão entre rodadas.
export const data = {
  manager: { name: 'Gestora E2E', email: 'gestora.e2e@buffet.local', password: 'Gestora123!', role: 'gestor' },
  client: { name: 'Mariana Souza', email: 'mariana.souza@example.com', phone: '(47) 99999-0000' },
  service: 'Buffet completo',
  kitchenTeam: { name: 'Cozinha Central', specialty: 'Cozinha', collaborator: { name: 'Carlos Lima', position: 'Chef' } },
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
