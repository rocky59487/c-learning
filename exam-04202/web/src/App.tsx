import { useEffect, useState } from 'react'
import { useProgress } from './store'
import { Home } from './screens/Home'
import { Study } from './screens/Study'
import { Exam } from './screens/Exam'
import { Review } from './screens/Review'
import { Settings } from './screens/Settings'

type View = 'home' | 'study' | 'exam' | 'review' | 'settings' | 'practice'
const VIEWS: View[] = ['home', 'study', 'exam', 'review', 'settings', 'practice']

function fromHash(): View {
  const h = location.hash.slice(1) as View
  return VIEWS.includes(h) && h !== 'practice' ? h : 'home'
}

export function App() {
  const { prog, touch, reset } = useProgress()
  const [view, setView] = useState<View>(fromHash)
  const [practice, setPractice] = useState<Set<string> | undefined>()

  useEffect(() => {
    const on = () => setView(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const go = (v: View) => {
    window.scrollTo(0, 0)
    if (v === 'practice') {
      setView(v)
      return
    }
    if (location.hash.slice(1) !== v) location.hash = v
    setView(v)
  }
  const home = () => go('home')

  switch (view) {
    case 'study':
      return <Study key="study" prog={prog} touch={touch} onExit={home} />
    case 'practice':
      return <Study key="practice" prog={prog} touch={touch} onExit={() => go('review')} only={practice} />
    case 'exam':
      return <Exam prog={prog} touch={touch} onExit={home} />
    case 'review':
      return (
        <Review
          prog={prog}
          onExit={home}
          onPractice={(ids) => {
            setPractice(new Set(ids))
            go('practice')
          }}
        />
      )
    case 'settings':
      return (
        <Settings
          onExit={home}
          onReset={() => {
            reset()
            home()
          }}
        />
      )
    default:
      return <Home prog={prog} go={go} />
  }
}
