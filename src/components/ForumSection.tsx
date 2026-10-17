import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.js';
import { ForumTopic, ForumCategory, ForumPost } from '../../shared/types.js';
import {
  MessageSquare,
  Search,
  Plus,
  Pin,
  Lock,
  ArrowLeft,
  Quote,
  Send,
  User,
  Heart,
  ShieldAlert,
  Coffee,
  Trash2
} from 'lucide-react';

export const ForumSection: React.FC = () => {
  const { session, t, lang } = useApp();

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // New Topic Form
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicContent, setTopicContent] = useState('');
  const [topicCategory, setTopicCategory] = useState('fc-dating');

  // Reply Form
  const [replyText, setReplyText] = useState('');
  const [quotePayload, setQuotePayload] = useState<{ author: string; text: string } | null>(null);

  const fetchCategories = () => {
    fetch('/api/forum/categories')
      .then(res => res.json())
      .then(data => {
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {});
  };

  const fetchTopics = () => {
    const url = selectedCategory
      ? `/api/forum/topics?categoryId=${selectedCategory}`
      : '/api/forum/topics';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.topics) setTopics(data.topics);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [selectedCategory]);

  const openTopic = (topic: ForumTopic) => {
    setSelectedTopic(topic);
    fetch(`/api/forum/topics/${topic.id}/posts`)
      .then(res => res.json())
      .then(data => {
        if (data.posts) setPosts(data.posts);
      })
      .catch(() => {});
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim() || !topicContent.trim()) return;

    try {
      const res = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        },
        body: JSON.stringify({
          categoryId: topicCategory,
          title: topicTitle,
          content: topicContent
        })
      });
      if (res.ok) {
        setIsCreatingTopic(false);
        setTopicTitle('');
        setTopicContent('');
        fetchTopics();
      }
    } catch {}
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTopic) return;

    try {
      const res = await fetch(`/api/forum/topics/${selectedTopic.id}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        },
        body: JSON.stringify({
          content: replyText,
          quoteContent: quotePayload?.text,
          quoteAuthor: quotePayload?.author
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => [...prev, data.post]);
        setReplyText('');
        setQuotePayload(null);
      }
    } catch {}
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm('Are you sure you want to delete this discussion topic?')) return;
    try {
      const res = await fetch(`/api/forum/topics/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.token}` }
      });
      if (res.ok) {
        setSelectedTopic(null);
        fetchTopics();
      }
    } catch {}
  };

  const handleTogglePin = async (id: string) => {
    try {
      const res = await fetch(`/api/forum/topics/${id}/pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.token}` }
      });
      if (res.ok) {
        setSelectedTopic(prev => prev ? { ...prev, isPinned: !prev.isPinned } : null);
        fetchTopics();
      }
    } catch {}
  };

  const handleToggleLock = async (id: string) => {
    try {
      const res = await fetch(`/api/forum/topics/${id}/lock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.token}` }
      });
      if (res.ok) {
        setSelectedTopic(prev => prev ? { ...prev, isLocked: !prev.isLocked } : null);
        fetchTopics();
      }
    } catch {}
  };

  const isModOrAdmin = session?.role === 'admin' || session?.role === 'moderator';
  const canDeleteTopic = selectedTopic && (selectedTopic.authorId === session?.userId || isModOrAdmin);

  // 1. TOPIC DETAIL VIEW
  if (selectedTopic) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-raised/40">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
          <button
            onClick={() => setSelectedTopic(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main w-fit transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Community Topics</span>
          </button>

          {/* Topic Original Post */}
          <div className="p-6 rounded-2xl bg-raised border border-line shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedTopic.isPinned && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                    <Pin className="w-3 h-3" /> Pinned
                  </span>
                )}
                {selectedTopic.isLocked && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
                <span className="text-xs text-text-muted">
                  {new Date(selectedTopic.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                {isModOrAdmin && (
                  <>
                    <button
                      onClick={() => handleTogglePin(selectedTopic.id)}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        selectedTopic.isPinned ? 'bg-amber-500 text-white' : 'hover:bg-white/10 text-text-muted'
                      }`}
                      title="Pin / Unpin Topic"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleLock(selectedTopic.id)}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        selectedTopic.isLocked ? 'bg-red-500 text-white' : 'hover:bg-white/10 text-text-muted'
                      }`}
                      title="Lock / Unlock Topic"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {canDeleteTopic && (
                  <button
                    onClick={() => handleDeleteTopic(selectedTopic.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                    title="Delete Topic"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-text-main">
              {selectedTopic.title}
            </h1>

            <p className="text-sm text-text-main/90 leading-relaxed whitespace-pre-wrap">
              {selectedTopic.content}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-line text-xs text-text-muted">
              <span>Author: <strong className="text-text-main">{selectedTopic.authorNickname}</strong></span>
              <span>{posts.length} replies</span>
            </div>
          </div>

          {/* Threaded Replies */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">
              Discussion Replies
            </h3>

            {posts.map(post => (
              <div
                key={post.id}
                className="p-4 rounded-xl bg-raised border border-line flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-bold">
                      {post.authorNickname.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-bold text-text-main">{post.authorNickname}</span>
                    <span className="text-text-muted text-[10px]">
                      {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <button
                    onClick={() => setQuotePayload({ author: post.authorNickname, text: post.content })}
                    className="flex items-center gap-1 text-[11px] text-text-muted hover:text-brand transition-colors"
                  >
                    <Quote className="w-3 h-3" />
                    <span>Quote</span>
                  </button>
                </div>

                {post.quoteContent && (
                  <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 border-l-2 border-brand text-xs text-text-muted italic">
                    <span className="font-semibold block text-[10px]">{post.quoteAuthor} wrote:</span>
                    "{post.quoteContent}"
                  </div>
                )}

                <p className="text-xs sm:text-sm text-text-main/90 leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          <form onSubmit={handleReply} className="flex flex-col gap-2 p-4 rounded-2xl bg-raised border border-line">
            {quotePayload && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-brand/10 text-xs text-brand">
                <span>Quoting {quotePayload.author}: "{quotePayload.text.slice(0, 60)}..."</span>
                <button type="button" onClick={() => setQuotePayload(null)} className="font-bold">✕</button>
              </div>
            )}
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a constructive, respectful response..."
              rows={3}
              required
              className="w-full p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-line focus:border-brand text-xs"
            />
            <button
              type="submit"
              className="self-end px-4 py-2 rounded-xl bg-brand text-white font-bold text-xs flex items-center gap-1.5 shadow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('postReply')}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. FORUM CATEGORIES & TOPICS LIST
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-raised/40">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-text-main flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-brand" />
              <span>{t('forumTitle')}</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Discuss dating, intimacy, cultural perspectives, and advice with community members.
            </p>
          </div>

          <button
            onClick={() => setIsCreatingTopic(true)}
            className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{t('newTopic')}</span>
          </button>
        </div>

        {/* Categories Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-brand/10 border-brand shadow-sm'
                    : 'bg-raised border-line hover:border-brand/40'
                }`}
              >
                <h4 className="text-sm font-bold text-text-main">
                  {lang === 'bn' ? cat.nameBn : cat.name}
                </h4>
                <p className="text-xs text-text-muted mt-1 line-clamp-2">
                  {cat.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Topics List */}
        <div className="flex flex-col gap-3">
          {topics.map(topic => (
            <div
              key={topic.id}
              onClick={() => openTopic(topic)}
              className="p-4 rounded-xl bg-raised border border-line hover:border-brand/50 flex items-center justify-between gap-4 cursor-pointer transition-all shadow-sm group"
            >
              <div className="flex flex-col gap-1 truncate">
                <div className="flex items-center gap-2">
                  {topic.isPinned && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                  <h3 className="text-sm font-bold text-text-main group-hover:text-brand transition-colors truncate">
                    {topic.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span>Started by {topic.authorNickname}</span>
                  <span>&bull;</span>
                  <span>{new Date(topic.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-text-muted shrink-0 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                <MessageSquare className="w-3.5 h-3.5 text-brand" />
                <span className="font-bold">{topic.replyCount}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Create Topic Modal */}
        {isCreatingTopic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-xl bg-raised border border-line rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
              <h3 className="text-lg font-bold text-text-main">Create Community Discussion</h3>
              <form onSubmit={handleCreateTopic} className="flex flex-col gap-3">
                <select
                  value={topicCategory}
                  onChange={e => setTopicCategory(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs font-semibold"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Discussion Title"
                  value={topicTitle}
                  onChange={e => setTopicTitle(e.target.value)}
                  required
                  className="px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-sm"
                />
                <textarea
                  placeholder="What would you like to discuss?"
                  value={topicContent}
                  onChange={e => setTopicContent(e.target.value)}
                  rows={5}
                  required
                  className="px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs"
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingTopic(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-brand text-white font-bold text-xs"
                  >
                    Post Topic
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
