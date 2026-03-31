import type React from 'react';
import { forwardRef } from 'react';

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

const iconClasses: Record<string, string> = {
  foreground: 'btn-icon-foreground',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'default', className, ...props }: ButtonProps,
  ref
) {
  const base =
    size === 'icon' ? (iconClasses[variant] ?? 'btn-icon-foreground') : defaultClasses[variant];
  return <button ref={ref} className={className ? `${base} ${className}` : base} {...props} />;
});
