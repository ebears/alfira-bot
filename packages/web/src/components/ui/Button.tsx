import type React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'foreground' | 'danger';
type ButtonSize = 'default' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const defaultClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  foreground: 'btn-foreground',
  danger: 'btn-danger',
};

const iconClasses: Record<ButtonVariant, string> = {
  primary: 'btn-icon-primary',
  secondary: 'btn-icon-secondary',
  foreground: 'btn-icon-foreground',
  danger: 'btn-icon-danger',
};

export function Button({
  variant = 'primary',
  size = 'default',
  className,
  ...props
}: ButtonProps) {
  const base = size === 'icon' ? iconClasses[variant] : defaultClasses[variant];
  return (
    <button
      className={className ? `${base} ${className}` : base}
      {...props}
    />
  );
}
