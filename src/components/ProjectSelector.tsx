import { useState } from 'react';
import { Project } from '../types/database';

interface ProjectSelectorProps {
  projects: Project[];
  isOpen: boolean;
  onClose: () => void;
  onProjectSelect: (projectId: string | null) => void;
  onCreateProject: (projectName: string) => Promise<string | null>; // Returns project ID or null
  selectedProjectId: string | null;
}

export default function ProjectSelector({ 
  projects, 
  isOpen, 
  onClose, 
  onProjectSelect, 
  onCreateProject,
  selectedProjectId 
}: ProjectSelectorProps) {
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleProjectSelect = (projectId: string | null) => {
    onProjectSelect(projectId);
    onClose();
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      const projectId = await onCreateProject(newProjectName.trim());
      if (projectId) {
        onProjectSelect(projectId);
        setNewProjectName('');
        setShowNewProjectForm(false);
        onClose();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-lg w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Select Project</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* No Project Option */}
          <button
            onClick={() => handleProjectSelect(null)}
            className={`w-full p-3 rounded-lg border transition-colors text-left ${
              selectedProjectId === null
                ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-gray-500 mr-3"></div>
              <span>No Project</span>
            </div>
          </button>

          {/* Existing Projects */}
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => handleProjectSelect(project.id)}
              className={`w-full p-3 rounded-lg border transition-colors text-left ${
                selectedProjectId === project.id
                  ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                  : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-full mr-3"
                  style={{ backgroundColor: project.color }}
                ></div>
                <span>{project.name}</span>
              </div>
            </button>
          ))}

          {/* Create New Project Button */}
          {!showNewProjectForm && (
            <button
              onClick={() => setShowNewProjectForm(true)}
              className="w-full p-3 rounded-lg border border-dashed border-slate-500 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
            >
              + Create New Project
            </button>
          )}

          {/* New Project Form */}
          {showNewProjectForm && (
            <div className="p-3 border border-slate-600 rounded-lg bg-slate-700">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                autoFocus
                disabled={isCreating}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || isCreating}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowNewProjectForm(false);
                    setNewProjectName('');
                  }}
                  className="px-3 py-1 bg-slate-600 text-slate-200 rounded-md hover:bg-slate-500 transition-colors"
                  disabled={isCreating}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 