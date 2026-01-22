import { Suspense } from 'react'
import ChecklistClient from './ChecklistClient'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 p-6 text-slate-600">
          Carregando checklist…
        </div>
      }
    >
      <ChecklistClient />
    </Suspense>
  )
}
