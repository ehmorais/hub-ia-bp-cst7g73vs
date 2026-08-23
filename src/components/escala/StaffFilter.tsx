import * as React from 'react'
import { Check, ChevronsUpDown, X, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface StaffOption {
  id: string
  name: string
  [key: string]: any
}

export function normalizeText(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function filterStaffByName<T extends StaffOption>(staffList: T[], searchTerm: string): T[] {
  const normalizedSearch = normalizeText(searchTerm)
  if (!normalizedSearch) return staffList
  return staffList.filter((staff) => normalizeText(staff.name).includes(normalizedSearch))
}

interface StaffFilterProps {
  staffList: StaffOption[]
  selectedStaffId: string
  onSelectedStaffChange: (staffId: string) => void
  label?: string
  placeholder?: string
  className?: string
  id?: string
}

export function StaffFilter({
  staffList,
  selectedStaffId,
  onSelectedStaffChange,
  label = 'Filtrar colaborador',
  placeholder = 'Todos os colaboradores',
  className,
  id = 'staff-filter-combobox',
}: StaffFilterProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')

  // Ordena em ordem alfabética e remove duplicados por id
  const sortedStaffOptions = React.useMemo(() => {
    const map = new Map<string, StaffOption>()
    staffList.forEach((s) => {
      if (s && s.id && !map.has(s.id)) {
        map.set(s.id, s)
      }
    })
    return Array.from(map.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }),
    )
  }, [staffList])

  const selectedStaff = React.useMemo(() => {
    return sortedStaffOptions.find((s) => s.id === selectedStaffId)
  }, [sortedStaffOptions, selectedStaffId])

  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelectedStaffChange('')
      setSearchValue('')
    },
    [onSelectedStaffChange],
  )

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-medium text-slate-700 select-none flex items-center gap-1.5"
        >
          <User className="h-3.5 w-3.5 text-slate-500" />
          <span>{label}</span>
        </label>
      )}

      <div className="flex items-center gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label={label}
              className={cn(
                'w-full min-w-[200px] sm:w-[240px] justify-between bg-white text-left font-normal h-9 px-3',
                !selectedStaff && 'text-muted-foreground',
              )}
            >
              <span className="truncate">{selectedStaff ? selectedStaff.name : placeholder}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0" align="start">
            <Command
              filter={(value, search) => {
                const normValue = normalizeText(value)
                const normSearch = normalizeText(search)
                return normValue.includes(normSearch) ? 1 : 0
              }}
            >
              <CommandInput
                placeholder="Pesquisar colaborador..."
                value={searchValue}
                onValueChange={setSearchValue}
                className="h-9"
              />
              <CommandList>
                <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    key="all-staff"
                    value="todos os colaboradores"
                    onSelect={() => {
                      onSelectedStaffChange('')
                      setOpen(false)
                      setSearchValue('')
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4', !selectedStaffId ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="font-medium text-slate-700">{placeholder}</span>
                  </CommandItem>
                  {sortedStaffOptions.map((staff) => (
                    <CommandItem
                      key={staff.id}
                      value={staff.name}
                      onSelect={() => {
                        onSelectedStaffChange(staff.id === selectedStaffId ? '' : staff.id)
                        setOpen(false)
                        setSearchValue('')
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedStaffId === staff.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="truncate">{staff.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedStaffId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            title="Limpar filtro de colaborador"
            aria-label="Limpar filtro de colaborador"
            className="h-9 w-9 text-slate-500 hover:text-slate-800 hover:bg-slate-100 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
