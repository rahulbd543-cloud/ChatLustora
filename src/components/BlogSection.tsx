import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.js';
import { BlogArticle, BlogComment } from '../../shared/types.js';
import {
  BookOpen,
  Search,
  Plus,
  Calendar,
  Eye,
  ArrowLeft,
  Tag,
  MessageCircle,
  Send,
  Trash2,
  Edit3
} from 'lucide-react';

export const BlogSection: React.FC = () => {
  const { session, t, lang } = useApp();

  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<BlogArticle | null>(null);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Create Article Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [editingArticle, setEditingArticle] = useState<BlogArticle | null>(null);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Dating & Romance');
  const [tags, setTags] = useState('bangla chat, adult dating');

  const fetchArticles = () => {
    setLoading(true);
    fetch(`/api/blog?search=${encodeURIComponent(search)}`)
      .then(res => res.json())
      .then(data => {
        if (data.articles) setArticles(data.articles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchArticles();
  }, [search]);

  const handleOpenArticle = (slug: string) => {
    fetch(`/api/blog/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data.article) {
          setSelectedArticle(data.article);
          fetchComments(data.article.id);
        }
      })
      .catch(() => {});
  };

  const fetchComments = (articleId: string) => {
    fetch(`/api/blog/${articleId}/comments`)
      .then(res => res.json())
      .then(data => {
        if (data.comments) setComments(data.comments);
      })
      .catch(() => {});
  };

  const handleCreateOrUpdateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      const url = editingArticle ? `/api/blog/${editingArticle.id}` : '/api/blog';
      const method = editingArticle ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        },
        body: JSON.stringify({
          title,
          excerpt,
          content,
          category,
          tags: tags.split(',').map(s => s.trim())
        })
      });

      if (res.ok) {
        setIsCreating(false);
        setEditingArticle(null);
        setTitle('');
        setExcerpt('');
        setContent('');
        fetchArticles();
        if (editingArticle) {
          setSelectedArticle(null);
        }
      }
    } catch {}
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      const res = await fetch(`/api/blog/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.token}` }
      });
      if (res.ok) {
        setSelectedArticle(null);
        fetchArticles();
      }
    } catch {}
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedArticle) return;

    try {
      const res = await fetch(`/api/blog/${selectedArticle.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        },
        body: JSON.stringify({ content: commentInput })
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [...prev, data.comment]);
        setCommentInput('');
      }
    } catch {}
  };

  const startEdit = (article: BlogArticle) => {
    setEditingArticle(article);
    setTitle(article.title);
    setExcerpt(article.excerpt);
    setContent(article.content);
    setCategory(article.category);
    setTags(article.tags.join(', '));
    setIsCreating(true);
  };

  const isModOrAdmin = session?.role === 'admin' || session?.role === 'moderator';

  // 1. ARTICLE DETAIL VIEW
  if (selectedArticle) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-raised/40">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedArticle(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main w-fit transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all articles</span>
            </button>

            {isModOrAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(selectedArticle)}
                  className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-brand hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteArticle(selectedArticle.id)}
                  className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Article Header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-brand/10 text-brand text-xs font-bold">
                {selectedArticle.category}
              </span>
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(selectedArticle.createdAt).toLocaleDateString()}
              </span>
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {selectedArticle.views} views
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main leading-tight">
              {selectedArticle.title}
            </h1>

            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>By {selectedArticle.authorNickname}</span>
              <span>&bull;</span>
              <span>ChatLustora Verified Author</span>
            </div>
          </div>

          {/* Cover image */}
          {selectedArticle.coverImageUrl && (
            <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-line shadow-md">
              <img
                src={selectedArticle.coverImageUrl}
                alt={selectedArticle.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Article Body */}
          <div className="prose prose-invert max-w-none text-text-main leading-relaxed text-sm sm:text-base space-y-4">
            {selectedArticle.content.split('\n\n').map((paragraph, i) => {
              if (paragraph.startsWith('### ')) {
                return (
                  <h3 key={i} className="text-lg font-bold text-brand mt-4 mb-2">
                    {paragraph.replace('### ', '')}
                  </h3>
                );
              }
              return (
                <p key={i} className="text-text-main/90 leading-relaxed">
                  {paragraph}
                </p>
              );
            })}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-line">
            {selectedArticle.tags.map(tag => (
              <span
                key={tag}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-text-muted"
              >
                <Tag className="w-3 h-3" />
                #{tag}
              </span>
            ))}
          </div>

          {/* Comments Section */}
          <div className="flex flex-col gap-4 pt-6 border-t border-line">
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-brand" />
              <span>Reader Discussion ({comments.length})</span>
            </h3>

            {/* Post comment box */}
            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="Share your perspective on this guide..."
                maxLength={500}
                required
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </form>

            {/* Comments list */}
            <div className="flex flex-col gap-2.5">
              {comments.map(c => (
                <div key={c.id} className="p-3.5 rounded-xl bg-raised border border-line flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span className="font-bold text-text-main">{c.authorNickname}</span>
                    <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-text-main/90">{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. BLOG LISTING VIEW
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-raised/40">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-text-main flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-brand" />
              <span>{t('blogTitle')}</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Expert advice on adult communication, Bangla dating culture, video chat etiquette, and consent.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search articles..."
                className="pl-9 pr-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line focus:border-brand text-xs"
              />
            </div>

            {isModOrAdmin && (
              <button
                onClick={() => {
                  setEditingArticle(null);
                  setTitle('');
                  setExcerpt('');
                  setContent('');
                  setIsCreating(true);
                }}
                className="px-3 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{t('newArticle')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Article Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map(article => (
            <div
              key={article.id}
              onClick={() => handleOpenArticle(article.slug)}
              className="group flex flex-col rounded-2xl bg-raised border border-line overflow-hidden hover:border-brand/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg"
            >
              {article.coverImageUrl && (
                <div className="w-full h-44 overflow-hidden bg-black/10">
                  <img
                    src={article.coverImageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              <div className="p-5 flex flex-col justify-between flex-1 gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="px-2 py-0.5 rounded bg-brand/10 text-brand font-bold text-[10px]">
                      {article.category}
                    </span>
                    <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                  </div>

                  <h3 className="text-base font-bold text-text-main group-hover:text-brand transition-colors line-clamp-2">
                    {article.title}
                  </h3>

                  <p className="text-xs text-text-muted line-clamp-3 leading-relaxed">
                    {article.excerpt}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-text-muted">
                  <span>By {article.authorNickname}</span>
                  <span className="text-brand font-bold group-hover:underline">Read article &rarr;</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Create/Edit Article Modal */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-xl bg-raised border border-line rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
              <h3 className="text-lg font-bold text-text-main">
                {editingArticle ? 'Edit Article' : 'Publish New Article'}
              </h3>
              <form onSubmit={handleCreateOrUpdateArticle} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Article Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-sm"
                />
                <input
                  type="text"
                  placeholder="Short Excerpt"
                  value={excerpt}
                  onChange={e => setExcerpt(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs"
                />
                <textarea
                  placeholder="Article Content (Markdown supported with ### headers)"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={6}
                  required
                  className="px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs"
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => { setIsCreating(false); setEditingArticle(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-brand text-white font-bold text-xs"
                  >
                    {editingArticle ? 'Save Changes' : 'Publish'}
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
