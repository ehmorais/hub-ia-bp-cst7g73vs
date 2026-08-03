let _completed = false

export function isChecklistCompleted(): boolean {
  return _completed
}

export function setChecklistCompleted(): void {
  _completed = true
}

export function resetChecklistCompleted(): void {
  _completed = false
}
