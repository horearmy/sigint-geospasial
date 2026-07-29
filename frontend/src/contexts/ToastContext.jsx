import { createContext, useContext } from 'react'

const ToastContext = createContext()
export function useToast() { return useContext(ToastContext) }
export default ToastContext
