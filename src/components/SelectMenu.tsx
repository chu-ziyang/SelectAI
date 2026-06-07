import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type SelectMenuOption<T extends string | number> = {
  value: T
  label: string
}

export default function SelectMenu<T extends string | number>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: readonly SelectMenuOption<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`select-menu ${className}`}>
      <button
        type="button"
        className={`select-menu-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="select-menu-popover">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`select-menu-option ${option.value === value ? 'is-selected' : ''}`}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
