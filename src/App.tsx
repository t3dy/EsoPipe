import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppProvider } from './contexts/AppContext';
import { TrailProvider } from './contexts/TrailContext';
import { AnnotationProvider } from './contexts/AnnotationContext';
import { ChatProvider } from './contexts/ChatContext';
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
import { Conversations } from './pages/Conversations';
import { ConversationDetail } from './pages/ConversationDetail';
import { AlchemyConcepts } from './pages/AlchemyConcepts';
import { Topics } from './pages/Topics';
import { SearchPage } from './pages/SearchPage';
import { EntityDetail } from './pages/EntityDetail';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <ChatProvider>
          <TrailProvider>
            <AnnotationProvider>
              <HashRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path='conversations' element={<Conversations />} />
                  <Route path='conversations/:id' element={<ConversationDetail />} />
                  <Route path='entities/:id' element={<EntityDetail />} />
                  <Route path='lessons' element={<Lessons />} />
                  <Route path='lessons/:id' element={<LessonDetail />} />
                  <Route path='tables' element={<Tables />} />
                  <Route path='timelines' element={<Timelines />} />
                  <Route path='graph' element={<Graph />} />
                  <Route path='alchemy' element={<AlchemyConcepts />} />
                  <Route path='topics' element={<Topics />} />
                  <Route path='search' element={<SearchPage />} />
                  <Route path='schema' element={<Schema />} />
                  <Route path='artifacts' element={<Artifacts />} />
                  <Route path='artifacts/:id' element={<ArtifactDetail />} />
                  <Route path='debug/retrieval' element={<RetrievalDebugger />} />
                  <Route path='reports' element={<Reports />} />
                  <Route path='about' element={<About />} />
                </Route>
              </Routes>
              </HashRouter>
            </AnnotationProvider>
          </TrailProvider>
        </ChatProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
