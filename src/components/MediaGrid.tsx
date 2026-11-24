import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface MediaGridProps {
  urls: string[];
}

export const MediaGrid: React.FC<MediaGridProps> = ({ urls }) => {
  const { colors } = useTheme();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!urls || urls.length === 0) return null;

  const openLightbox = (index: number) => setLightboxIndex(index);

  const renderGrid = () => {
    if (urls.length === 1) {
      return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => openLightbox(0)}>
          <Image source={{ uri: urls[0] }} style={styles.singleImage} resizeMode="cover" />
        </TouchableOpacity>
      );
    }

    if (urls.length === 2) {
      return (
        <View style={styles.row2}>
          {urls.map((uri, i) => (
            <TouchableOpacity key={i} style={styles.half} activeOpacity={0.9} onPress={() => openLightbox(i)}>
              <Image source={{ uri }} style={styles.fill} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (urls.length === 3) {
      return (
        <View style={styles.row3}>
          <TouchableOpacity style={styles.half} activeOpacity={0.9} onPress={() => openLightbox(0)}>
            <Image source={{ uri: urls[0] }} style={styles.fill} resizeMode="cover" />
          </TouchableOpacity>
          <View style={styles.rightStack}>
            <TouchableOpacity style={styles.halfHeight} activeOpacity={0.9} onPress={() => openLightbox(1)}>
              <Image source={{ uri: urls[1] }} style={styles.fill} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.halfHeight} activeOpacity={0.9} onPress={() => openLightbox(2)}>
              <Image source={{ uri: urls[2] }} style={styles.fill} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.grid4}>
        <View style={styles.grid4Row}>
          <TouchableOpacity style={styles.half} activeOpacity={0.9} onPress={() => openLightbox(0)}>
            <Image source={{ uri: urls[0] }} style={styles.fill} resizeMode="cover" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.half} activeOpacity={0.9} onPress={() => openLightbox(1)}>
            <Image source={{ uri: urls[1] }} style={styles.fill} resizeMode="cover" />
          </TouchableOpacity>
        </View>
        <View style={styles.grid4Row}>
          <TouchableOpacity style={styles.half} activeOpacity={0.9} onPress={() => openLightbox(2)}>
            <Image source={{ uri: urls[2] }} style={styles.fill} resizeMode="cover" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.half} activeOpacity={0.9} onPress={() => openLightbox(3)}>
            <Image source={{ uri: urls[3] }} style={styles.fill} resizeMode="cover" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={[styles.container, { borderColor: colors.border }]}>{renderGrid()}</View>

      <Modal
        visible={lightboxIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxIndex(null)}
      >
        <StatusBar hidden />
        <View style={styles.lightboxBackdrop}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setLightboxIndex(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (lightboxIndex || 0) * SCREEN_W, y: 0 }}
          >
            {urls.map((uri, i) => (
              <View key={i} style={styles.lightboxSlide}>
                <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  singleImage: { width: '100%', height: 260 },
  row2: { flexDirection: 'row', height: 210, gap: 2 },
  row3: { flexDirection: 'row', height: 220, gap: 2 },
  rightStack: { flex: 1, gap: 2 },
  grid4: { height: 230, gap: 2 },
  grid4Row: { flex: 1, flexDirection: 'row', gap: 2 },
  half: { flex: 1 },
  halfHeight: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 44,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 6,
  },
  lightboxSlide: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: { width: SCREEN_W, height: SCREEN_H * 0.85 },
});
