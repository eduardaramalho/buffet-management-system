// RF25: a copied manual task keeps the same distance (in milliseconds) to the event as it had
// in the source event, so "7 days before at 09:30" stays "7 days before at 09:30".
export function shiftDueDate(dueDate: Date | null, sourceEventDate: Date, newEventDate: Date): Date | null {
  if (!dueDate) return null;
  const offsetFromEvent = dueDate.getTime() - sourceEventDate.getTime();
  return new Date(newEventDate.getTime() + offsetFromEvent);
}

export function isBefore(date: Date | null, reference: Date): boolean {
  return date !== null && date.getTime() < reference.getTime();
}
