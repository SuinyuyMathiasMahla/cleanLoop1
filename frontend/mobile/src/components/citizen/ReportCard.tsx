import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportsApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { reportTypeLabel, timeAgo } from '../../utils/format';

interface ReportComment {
  commentId: string;
  name: string;
  text: string;
  createdAt: string;
}

interface ReportCardProps {
  report: {
    reportId?: string;
    type?: string;
    address?: string;
    description?: string;
    status?: string;
    createdAt?: string;
    submitterName?: string;
    photoUrl?: string;
    evidencePhotoUrls?: string[];
    likeCount?: number;
    likedByMe?: boolean;
    comments?: ReportComment[];
  };
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: '#fef3c7', color: '#92400e' },
  assigned: { label: 'Assigned', bg: '#dbeafe', color: '#1e40af' },
  in_progress: { label: 'In progress', bg: '#e0e7ff', color: '#3730a3' },
  resolved: { label: 'Resolved', bg: '#d1fae5', color: '#065f46' },
};

export function ReportCard({ report, onPress, style }: ReportCardProps) {
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(!!report.likedByMe);
  const [likeCount, setLikeCount] = useState(report.likeCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [comments, setComments] = useState<ReportComment[]>(report.comments ?? []);

  useEffect(() => {
    setLiked(!!report.likedByMe);
    setLikeCount(report.likeCount ?? 0);
    setComments(report.comments ?? []);
  }, [report.likedByMe, report.likeCount, report.comments]);

  async function toggleLike() {
    if (!user) return Alert.alert('Sign in required', 'Sign in to like community reports.');
    if (!report.reportId) return;
    // Optimistic update, rolled back on failure
    const prev = { liked, likeCount };
    setLiked(!liked);
    setLikeCount(Math.max(0, likeCount + (liked ? -1 : 1)));
    try {
      const result = await reportsApi.toggleLike(report.reportId);
      setLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
    } catch {
      setLiked(prev.liked);
      setLikeCount(prev.likeCount);
      Alert.alert('Could not update like', 'Please try again.');
    }
  }

  async function submitComment() {
    if (!user) return Alert.alert('Sign in required', 'Sign in to comment on community reports.');
    if (!report.reportId || !commentText.trim()) return;
    setSending(true);
    try {
      const result = await reportsApi.addComment(report.reportId, commentText.trim());
      setComments((current) => [...current, (result.data as any).comment]);
      setCommentText('');
    } catch {
      Alert.alert('Could not add comment', 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  const status = report.status ? STATUS[report.status] : undefined;
  const evidencePhotos = (report.evidencePhotoUrls ?? []).filter(Boolean);
  const canViewEvidence = report.status === 'resolved' && evidencePhotos.length > 0;

  return (
    <View style={[styles.card, style]}>
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        activeOpacity={onPress ? 0.75 : 1}
        disabled={!onPress}
      >
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color={colors.primary} />
          </View>
          <View style={styles.authorCopy}>
            <Text style={styles.authorName} numberOfLines={1}>
              {report.submitterName || 'Anonymous'}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {reportTypeLabel(report.type)} · {timeAgo(report.createdAt)}
            </Text>
          </View>
        </View>
        <Text style={styles.description}>{report.description || 'Reported a waste issue.'}</Text>
        {!!report.address && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={13} color={colors.gray[500]} />
            <Text style={styles.address} numberOfLines={1}>
              {report.address}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {!!report.photoUrl && (
        <View style={styles.photoFrame}>
          <Image source={{ uri: report.photoUrl }} style={styles.photo} resizeMode="cover" />
          <View style={styles.photoTag}>
            <Text style={styles.photoTagText}>Reported</Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.action}
          onPress={toggleLike}
          accessibilityLabel="Like report"
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? '#e11d48' : colors.gray[700]}
          />
          <Text style={styles.actionText}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.action}
          onPress={() => setShowComments(true)}
          accessibilityLabel="Comment on report"
        >
          <Ionicons name="chatbubble-outline" size={19} color={colors.gray[700]} />
          <Text style={styles.actionText}>{comments.length}</Text>
        </TouchableOpacity>
        {status &&
          (canViewEvidence ? (
            <TouchableOpacity
              style={[styles.statusChip, { backgroundColor: status.bg }]}
              onPress={() => setShowEvidence(true)}
              accessibilityRole="button"
              accessibilityLabel="Resolved. View cleanup evidence"
            >
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              <Ionicons name="image-outline" size={13} color={status.color} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          ))}
      </View>

      <Modal
        visible={showEvidence}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEvidence(false)}
      >
        <View style={styles.modalShade}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cleanup evidence</Text>
              <TouchableOpacity
                onPress={() => setShowEvidence(false)}
                accessibilityLabel="Close cleanup evidence"
              >
                <Ionicons name="close" size={23} color={colors.gray[700]} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {evidencePhotos.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={styles.evidencePhoto}
                  resizeMode="cover"
                  accessibilityLabel={`Cleanup evidence ${index + 1}`}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showComments}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalShade}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity
                onPress={() => setShowComments(false)}
                accessibilityLabel="Close comments"
              >
                <Ionicons name="close" size={23} color={colors.gray[700]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.commentList} keyboardShouldPersistTaps="handled">
              {comments.length === 0 && (
                <Text style={styles.signInHint}>No comments yet. Be the first!</Text>
              )}
              {comments.map((comment) => (
                <View style={styles.comment} key={comment.commentId}>
                  <View style={styles.commentTop}>
                    <Text style={styles.commentName}>{comment.name}</Text>
                    <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              ))}
            </ScrollView>
            {user ? (
              <View style={styles.commentInputRow}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Write a comment"
                  placeholderTextColor={colors.gray[500]}
                  style={styles.commentInput}
                  maxLength={1000}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (sending || !commentText.trim()) && { opacity: 0.5 }]}
                  onPress={submitComment}
                  disabled={sending || !commentText.trim()}
                  accessibilityLabel="Send comment"
                >
                  <Ionicons name="send" size={17} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.signInHint}>Sign in to add a comment.</Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 0,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  content: { paddingHorizontal: 14, paddingTop: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 1,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  authorCopy: { flex: 1 },
  authorName: { fontSize: 14, fontWeight: '800', color: colors.gray[900] },
  meta: { fontSize: 11.5, color: colors.gray[500], marginTop: 2, textTransform: 'capitalize' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  statusText: { fontSize: 10.5, fontWeight: '800' },
  description: { fontSize: 14, color: colors.gray[700], marginBottom: 6, lineHeight: 20 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  address: { flex: 1, fontSize: 12.5, color: colors.gray[500] },
  photoFrame: { width: '100%', borderRadius: 1, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: 190, borderRadius: 1, backgroundColor: colors.gray[100] },
  photoTag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(15,61,46,0.82)',
    borderRadius: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoTagText: { fontSize: 10.5, fontWeight: '700', color: '#fff' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    marginTop: 12,
    marginHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.gray[700] },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.gray[900] },
  commentList: { flexGrow: 0 },
  comment: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  commentTop: { flexDirection: 'row', justifyContent: 'space-between' },
  commentName: { fontSize: 12.5, fontWeight: '800', color: colors.gray[900] },
  commentTime: { fontSize: 11, color: colors.gray[500] },
  commentText: { fontSize: 13.5, color: colors.gray[700], marginTop: 3, lineHeight: 19 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  commentInput: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: '#f8faf9',
    borderRadius: 1,
    paddingHorizontal: 14,
    fontSize: 14.5,
    color: colors.gray[900],
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInHint: { fontSize: 13, color: colors.gray[500], marginTop: 12 },
  evidencePhoto: {
    width: '100%',
    height: 240,
    borderRadius: 1,
    backgroundColor: colors.gray[100],
    marginBottom: 12,
  },
});
