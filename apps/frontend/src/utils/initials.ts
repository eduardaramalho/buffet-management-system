/** Iniciais do nome (até duas letras), para avatares. */
export const initials = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
