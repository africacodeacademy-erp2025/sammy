 "use client";
import { ScheduledPost } from "../Types";
import { useState, useMemo } from "react";

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: ScheduledPost[];
}

export default function ScheduledPostView({
  onBack,
  scheduledPosts = [], // Default to empty array
}: {
  onBack: () => void;
  scheduledPosts?: ScheduledPost[]; // Make it optional
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };
  
  const miniCalendarDays = useMemo((): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay.getTime() - firstDay.getDay() * 24 * 60 * 60 * 1000);
    const endDate = new Date(lastDay.getTime() + (6 - lastDay.getDay()) * 24 * 60 * 60 * 1000);
    
    const days: CalendarDay[] = [];
    const today = new Date().toDateString();
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateString = d.toDateString();
      days.push({
        date: new Date(d),
        isCurrentMonth: d.getMonth() === month,
        isToday: dateString === today,
        posts: scheduledPosts.filter(post => new Date(post.timestamp).toDateString() === dateString),
      });
    }
    return days;
  }, [currentDate, scheduledPosts]);
  
  const selectedDatePosts = useMemo(() => {
    return scheduledPosts.filter(post => 
      new Date(post.timestamp).toDateString() === selectedDate.toDateString()
    );
  }, [selectedDate, scheduledPosts]);
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["S", "M", "T", "W", "Th", "F", "S"];
  
  const generatePostsForDate = (date: Date) => {
    // Navigate back to chat to generate posts
    onBack();
  };
  const handleCancelPost = (postId: string) => console.log(`Cancel post ${postId}`);
  const handleEditPost = (postId: string) => console.log(`Edit post ${postId}`);
  
  const formatTime = (timestamp: string | number) => 
    new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  
  const getPlatformStyle = (platform: string) => ({
    Twitter: 'bg-purple-500/20 text-purple-300',
    LinkedIn: 'bg-blue-500/20 text-blue-300',
  }[platform] || 'bg-green-500/20 text-green-300');
  
  const getStatusStyle = (status: string) => ({
    scheduled: 'bg-amber-500/20 text-amber-300',
    posted: 'bg-green-500/20 text-green-300',
  }[status] || 'bg-rose-500/20 text-rose-300');

  const stats = [
    { value: scheduledPosts.length, label: 'Total Scheduled', color: 'text-white' },
    { 
      value: scheduledPosts.filter(p => new Date(p.timestamp).toDateString() === new Date().toDateString()).length,
      label: 'Today', 
      color: 'text-blue-400' 
    },
  ];

  return (
    <div className="flex h-screen w-full bg-gray-950">
      {/* Sidebar */}
      <div className="w-80 bg-gray-900/90 backdrop-blur-xl border-r border-gray-700/50 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl border-b border-gray-700/50">
          <div className="flex items-center gap-3 mb-6">
            <button 
              onClick={onBack} 
              className="p-2 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors"
            >
              ←
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">📅</span>
              </div>
              <div>
                <h1 className="font-bold text-white">Content Calendar</h1>
                <p className="text-xs text-white/60">Scheduled Posts Overview</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => generatePostsForDate(new Date())} 
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <span className="text-lg">+</span>
            <span>Create Post</span>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {/* Calendar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
              <div className="flex gap-1">
                {[-1, 1].map(dir => (
                  <button 
                    key={dir} 
                    onClick={() => navigateMonth(dir)} 
                    className="w-7 h-7 rounded bg-gray-700/50 text-white hover:bg-gray-700 transition-colors flex items-center justify-center text-sm"
                  >
                    {dir === -1 ? '‹' : '›'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-xs">
              {dayNames.map((day, i) => (
                <div key={i} className="text-center text-gray-400 font-medium py-1">{day}</div>
              ))}
              {miniCalendarDays.map((day, i) => (
                <button
                  key={`${i}-${day.date.getTime()}`}
                  onClick={() => setSelectedDate(day.date)}
                  className={`h-8 text-xs rounded transition-all relative
                    ${!day.isCurrentMonth ? 'text-gray-600' : 'text-gray-200'}
                    ${day.isToday ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold' : ''}
                    ${selectedDate.toDateString() === day.date.toDateString() && !day.isToday ? 'bg-gray-700/80 text-white' : ''}
                    ${!day.isToday && selectedDate.toDateString() !== day.date.toDateString() ? 'hover:bg-gray-800/50' : ''}`}
                >
                  {day.date.getDate()}
                  {day.posts.length > 0 && <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full"></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-3 mb-6">
            {stats.map(({ value, label, color }, i) => (
              <div key={i} className="bg-gray-800/80 p-3 rounded-lg backdrop-blur-sm border border-gray-700/50">
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                <div className="text-xs text-white/60">{label}</div>
              </div>
            ))}
          </div>

          {/* AI Insights */}
          {scheduledPosts.length > 0 && (
            <div className="bg-gray-800/80 p-4 rounded-lg backdrop-blur-sm border border-gray-700/50">
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <span>🧠</span>Content Insights
              </h4>
              <div className="text-xs text-white/60 mb-2">
                {selectedDate.toDateString() === new Date().toDateString() ? 'TODAY' : selectedDate.toLocaleDateString().toUpperCase()}
              </div>
              <div className="text-xs text-white/40">
                {selectedDatePosts.length > 0 
                  ? `${selectedDatePosts.length} post${selectedDatePosts.length > 1 ? 's' : ''} scheduled`
                  : 'No posts scheduled for this date'
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {['‹', '›'].map(arrow => (
                  <button 
                    key={arrow} 
                    className="w-8 h-8 rounded bg-gray-700/50 text-white hover:bg-gray-700 transition-colors flex items-center justify-center"
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(selectedDate.getDate() + (arrow === '›' ? 1 : -1));
                      setSelectedDate(newDate);
                    }}
                  >
                    {arrow}
                  </button>
                ))}
              </div>
              <h2 className="text-xl text-white font-medium">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900/30 to-gray-900/10">
          <div className="p-6">
            {selectedDatePosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="text-6xl mb-6">📝</div>
                <h3 className="text-2xl font-bold text-white mb-4">No posts scheduled</h3>
                <p className="text-white/60 text-lg max-w-md">
                  {selectedDate.toDateString() === new Date().toDateString() ? 
                    "You don't have any posts scheduled for today." :
                    "You don't have any posts scheduled for this date."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-white font-bold text-lg mb-2">
                    {selectedDatePosts.length} post{selectedDatePosts.length > 1 ? 's' : ''} scheduled
                  </h3>
                  <p className="text-white/60">
                    {selectedDate.toDateString() === new Date().toDateString() ? 'Today' : selectedDate.toLocaleDateString()}
                  </p>
                </div>
                
                {selectedDatePosts.map((post, i) => (
                  <div 
                    key={`${post.id}-${i}`} 
                    onClick={() => handleEditPost(post.id)} 
                    className="group bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 hover:bg-gray-800/90 transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 text-center">
                        <div className="text-lg font-bold text-white">{formatTime(post.timestamp)}</div>
                        <div className="text-xs text-white/60 mt-1">
                          {new Date(post.timestamp).getHours() < 12 ? 'AM' : 'PM'}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getPlatformStyle(post.platform)}`}>
                            {post.platform}
                          </span>
                          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getStatusStyle(post.status)}`}>
                            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                          </span>
                        </div>
                        
                        <p className="text-white text-base leading-relaxed mb-4">{post.content}</p>
                        
                        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                            ✏️ Edit
                          </button>
                          {post.status === "scheduled" && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleCancelPost(post.id); 
                              }} 
                              className="text-sm text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              ❌ Cancel
                            </button>
                          )}
                          <button className="text-sm text-white/60 hover:text-white/80 transition-colors">
                            📊 Analytics
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}