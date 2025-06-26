import { useState } from 'react';
import { Goal, Value } from '../types/database';
import { getValueIcon } from '../lib/valueIcons';

interface GoalSelectorProps {
  goals: Goal[];
  values: Value[];
  onGoalSelect: (goalIds: string[]) => void;
  onClose: () => void;
  isOpen: boolean;
  selectedGoalIds?: string[];
  multiple?: boolean;
}

export default function GoalSelector({ 
  goals, 
  values, 
  onGoalSelect, 
  onClose, 
  isOpen, 
  selectedGoalIds = [],
  multiple = false 
}: GoalSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [localSelectedGoals, setLocalSelectedGoals] = useState<string[]>(selectedGoalIds);

  if (!isOpen) return null;

  // Group goals by value
  const goalsByValue = values.map(value => ({
    value,
    goals: goals.filter(goal => goal.value_id === value.id)
  })).filter(group => group.goals.length > 0);

  // Filter goals by search term
  const filteredGoalsByValue = goalsByValue.map(group => ({
    ...group,
    goals: group.goals.filter(goal => 
      goal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.value.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(group => group.goals.length > 0);

  const handleGoalClick = (goalId: string) => {
    if (multiple) {
      const newSelected = localSelectedGoals.includes(goalId)
        ? localSelectedGoals.filter(id => id !== goalId)
        : [...localSelectedGoals, goalId];
      setLocalSelectedGoals(newSelected);
    } else {
      onGoalSelect([goalId]);
      onClose();
    }
  };

  const handleConfirm = () => {
    onGoalSelect(localSelectedGoals);
    onClose();
  };

  const handleNoGoalClick = () => {
    onGoalSelect([]);
    onClose();
  };

  const isGoalSelected = (goalId: string) => {
    return localSelectedGoals.includes(goalId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-2 sm:p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] sm:max-h-[80vh] flex flex-col border border-slate-700">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-200">
              {multiple ? 'Select Goals' : 'Select a Goal'}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl transition-colors"
            >
              ×
            </button>
          </div>
          <input
            type="text"
            placeholder="Search goals or values..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 bg-slate-700 text-slate-200"
            autoFocus
          />
          {multiple && localSelectedGoals.length > 0 && (
            <div className="mt-3 p-2 bg-forest-900 border border-forest-600 rounded-md">
              <p className="text-sm text-forest-200">
                <span className="font-medium">Selected:</span> {localSelectedGoals.length} goal{localSelectedGoals.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredGoalsByValue.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">No goals found matching "{searchTerm}"</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {filteredGoalsByValue.map(({ value, goals: valueGoals }) => (
                <div key={value.id} className="space-y-3">
                  {/* Value Header */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xl sm:text-2xl">{getValueIcon(value.name)}</span>
                    <h3 className="text-base sm:text-lg font-medium text-slate-200">{value.name}</h3>
                  </div>
                  
                  {/* Goals Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {valueGoals.map(goal => (
                      <button
                        key={goal.id}
                        onClick={() => handleGoalClick(goal.id)}
                        className={`p-3 sm:p-4 border rounded-lg transition-colors text-left group bg-slate-700 ${
                          isGoalSelected(goal.id)
                            ? 'border-forest-500 bg-forest-900'
                            : 'border-slate-600 hover:border-forest-500 hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-start space-x-2 sm:space-x-3">
                          {multiple && (
                            <input
                              type="checkbox"
                              checked={isGoalSelected(goal.id)}
                              readOnly
                              className="h-4 w-4 text-forest-600 focus:ring-forest-500 border-slate-500 rounded bg-slate-600 mt-1 flex-shrink-0"
                            />
                          )}
                          <span className={`text-base sm:text-lg flex-shrink-0 ${
                            isGoalSelected(goal.id) ? 'text-forest-400' : 'text-slate-400 group-hover:text-forest-400'
                          }`}>
                            {getValueIcon(value.name)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium text-sm sm:text-base ${
                              isGoalSelected(goal.id) ? 'text-forest-300' : 'text-slate-200 group-hover:text-forest-300'
                            }`}>
                              {goal.name}
                            </h4>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1">
                              {value.name}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-700 bg-slate-800 flex-shrink-0">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleNoGoalClick}
              className="flex-1 py-2 sm:py-3 px-4 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors text-slate-300 font-medium"
            >
              No Goal
            </button>
            {multiple && (
              <button
                onClick={handleConfirm}
                className="flex-1 py-2 sm:py-3 px-4 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors font-medium"
              >
                Confirm ({localSelectedGoals.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 