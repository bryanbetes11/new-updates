import { useEffect, useId, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  'aria-label'?: string;
}

export function Select({ value, onChange, options, placeholder, className = '', icon, 'aria-label': ariaLabel }: SelectProps) {
  const id = useId();
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    const label = ref.current?.parentElement?.parentElement?.querySelector(':scope > label');
    if (label instanceof HTMLLabelElement && !label.htmlFor) label.htmlFor = id;
  }, [id]);
  const hasSelection = options.some(option => option.value === value);
  return (
    <div className={`relative ${className}`}>
      {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
      <select ref={ref} id={id} value={hasSelection ? value : ''} aria-label={ariaLabel}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
        className={`input-field min-h-11 w-full appearance-none pr-10 ${icon ? 'pl-10' : ''}`}>
        {!hasSelection && <option value="" disabled>{placeholder || 'Select...'}</option>}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
