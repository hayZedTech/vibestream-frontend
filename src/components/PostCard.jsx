export default function PostCard({ post, onLike, onComment }) {
  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex align-items-center mb-2">
          <img src={post.user.avatar || '/default-avatar.png'} alt="avatar" className="rounded-circle me-2" width="40" />
          <strong>{post.user.username}</strong>
        </div>
        <p>{post.text}</p>
        {post.image && <img src={post.image} alt="post" className="img-fluid" />}
        <div className="mt-2">
          <button className="btn btn-sm btn-outline-primary me-2" onClick={() => onLike(post._id)}>
            Like ({post.likes.length})
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onComment(post._id)}>
            Comment ({post.comments.length})
          </button>
        </div>
      </div>
    </div>
  );
}
