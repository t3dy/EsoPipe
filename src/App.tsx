import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Lessons } from './pages/Lessons';
import { LessonDetail } from './pages/LessonDetail';
import Tables from './pages/Tables';
import { Timelines } from './pages/Timelines';
import { Graph } from './pages/Graph';
import { Schema } from './pages/Schema';
import { About } from './pages/About';
import { Reports } from './pages/Reports';
import { Artifacts } from './pages/Artifacts';
import { ArtifactDetail } from './pages/ArtifactDetail';
import { RetrievalDebugger } from './pages/RetrievalDebugger';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="lessons" element={<Lessons />} />
              <Route path="lessons/:id" element={<LessonDetail />} />
              <Route path="tables" element={<Tables />} />
              <Route path="timelines" element={<Timelines />} />
              <Route path="graph" element={<Graph />} />
              <Route path="schema" element={<Schema />} />
              <Route path="artifacts" element={<Artifacts />} />
              <Route path="artifacts/:id" element={<ArtifactDetail />} />
              <Route path="debug/retrieval" element={<RetrievalDebugger />} />
              <Route path="reports" element={<Reports />} />
              <Route path="about" element={<About />} />
            </Route>
          </Routes>
        </HashRouter>
      </AppProvider>
    </ThemeProvider>
  );
}
