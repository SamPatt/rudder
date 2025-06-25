// Icon mapping for different values
export const getValueIcon = (valueName: string) => {
  const iconMap: { [key: string]: string } = {
    'Survival': '🛡️',
    'Independence': '🦅',
    'Directed love': '❤️',
    'Being grounded in reality': '🏠',
    'Do no harm': '🕊️',
    'Curiosity': '🔍',
    'Improvement (self + world)': '🚀'
  };
  return iconMap[valueName] || '🎯';
}; 