import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { styled } from 'styled-components'
import { PlatformIcon } from '@purescience/platform-ui/components/chrome/PlatformIcon'
import { MenuPortal } from '@purescience/platform-ui/components/common/dropdown/MenuPortal'
import { isMenuInteractionTarget } from '@purescience/platform-ui/components/common/dropdown/menuPortalConstants'

export interface SelectOption {
  id: string
  label: string
}

interface SelectFieldProps {
  label: string
  value: string | null
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  onChange: (id: string) => void
}

//#region styled-components

const StyledField = styled.label`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs, 4px);
`

const StyledLabel = styled.span`
  color: var(--pure-chrome-muted);
  font-size: var(--pure-chrome-ui-size);
  font-weight: 500;
  line-height: 1.35;
`

// A platform field (32px, hairline, surface) that opens a menu.
/** Typed loosely on purpose: styled-components' attrs rejects data-* literals. */
const fieldChrome: Record<string, string> = { 'data-chrome': 'field' }

const StyledTrigger = styled.button.attrs(fieldChrome)`
  width: 100%;
  border-radius: var(--purechart-radius-control, var(--pure-chrome-radius));
  font-weight: 500;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled),
  &[aria-expanded='true'] {
    border-color: var(--pure-chrome-soft);
  }

  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--pure-chrome-accent) 34%, transparent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }
`

const StyledValue = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const StyledCaret = styled.span`
  display: inline-flex;
  color: var(--pure-chrome-muted);
`

// The menu is portaled outside the workspace root, so it reads the platform
// chrome tokens directly rather than the --purechart-* aliases.
const StyledPanel = styled.div`
  box-sizing: border-box;
  width: 100%;
  max-height: min(248px, calc(100vh - 24px));
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--pure-chrome-line);
  border-radius: var(--platform-radius-md);
  background: var(--pure-chrome-surface);
  color: var(--platform-colors-text);
  box-shadow: var(--platform-shadow-md);
  font-family: var(--platform-typography-font-family);
  font-size: var(--pure-chrome-ui-size);
  line-height: 1.35;
`

const StyledOption = styled.button<{ $selected?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: var(--pure-chrome-row-height);
  padding: 7px 8px;
  border: 0;
  border-radius: var(--platform-radius-sm);
  background: ${({ $selected }) =>
    $selected ? 'var(--pure-chrome-selection)' : 'transparent'};
  color: var(--platform-colors-text);
  font: inherit;
  font-weight: 500;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--pure-chrome-hover);
  }

  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--pure-chrome-accent) 34%, transparent);
    outline-offset: -2px;
  }
`

const StyledCheck = styled.span`
  width: 5px;
  height: 5px;
  border-radius: var(--platform-radius-sm);
  background: var(--pure-chrome-muted);
`

//#endregion

export function SelectField({
  label,
  value,
  options,
  placeholder = 'Select...',
  disabled = false,
  onChange,
}: SelectFieldProps): React.ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const current = options.find(option => option.id === value)
  const isDisabled = disabled || options.length === 0

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent): void => {
      if (isMenuInteractionTarget(event.target)) return
      close()
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  const handleSelect = (id: string): void => {
    onChange(id)
    close()
  }

  return (
    <StyledField>
      <StyledLabel>{label}</StyledLabel>
      <StyledTrigger
        ref={triggerRef}
        type="button"
        disabled={isDisabled}
        data-platform-menu-trigger
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(currentOpen => !currentOpen)}
      >
        <StyledValue>{current?.label ?? placeholder}</StyledValue>
        <StyledCaret aria-hidden="true">
          <PlatformIcon icon={ChevronDown} size={14} strokeWidth={1.8} />
        </StyledCaret>
      </StyledTrigger>
      <MenuPortal
        anchorRef={triggerRef}
        open={open}
        placement="below-start"
        widthMode="anchor"
        minWidth={160}
        data-platform-menu-surface
      >
        <StyledPanel role="menu" aria-label={label}>
          {options.map(option => (
            <StyledOption
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={option.id === value}
              $selected={option.id === value}
              onClick={() => handleSelect(option.id)}
            >
              <span>{option.label}</span>
              {option.id === value ? <StyledCheck aria-hidden="true" /> : null}
            </StyledOption>
          ))}
        </StyledPanel>
      </MenuPortal>
    </StyledField>
  )
}
