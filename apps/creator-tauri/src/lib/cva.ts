import { clsx, type ClassValue } from 'clsx'
import { cva as cvaFn, cx } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

export const cva = cvaFn

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const compose = (...classes: ClassValue[]) => cn(...classes)
export { cx }
