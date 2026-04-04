import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert
} from 'react-native';

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video } from 'expo-av';

// 🔔 إعداد الإشعارات
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {

  const [url, setUrl] = useState('');
  const [downloads, setDownloads] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentVideo, setCurrentVideo] = useState(null);

  const MAX_RETRIES = 3;

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    await Notifications.requestPermissionsAsync();
    loadDownloads();
  };

  const loadDownloads = async () => {
    const data = await AsyncStorage.getItem('downloads');
    if (data) setDownloads(JSON.parse(data));
  };

  const saveDownload = async (item) => {
    const updated = [item, ...downloads];
    setDownloads(updated);
    await AsyncStorage.setItem('downloads', JSON.stringify(updated));
  };

  const sendNotification = async (title, body) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  };

  // 🔗 API (غير الرابط)
  const getVideo = async () => {
    const res = await fetch('https://YOUR_API/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    return data.video;
  };

  // 📥 تحميل مع إعادة المحاولة
  const downloadVideo = async (retry = 0) => {
    try {
      if (!url) return Alert.alert('خطأ', 'أدخل الرابط');

      await sendNotification('⏳ بدء التحميل', 'جاري تحميل الفيديو...');

      const videoUrl = await getVideo();

      const fileUri = FileSystem.documentDirectory + Date.now() + '.mp4';

      const downloadResumable = FileSystem.createDownloadResumable(
        videoUrl,
        fileUri,
        {},
        (p) => {
          const percent = p.totalBytesWritten / p.totalBytesExpectedToWrite;
          setProgress(Math.floor(percent * 100));
        }
      );

      const result = await downloadResumable.downloadAsync();

      const item = {
        id: Date.now().toString(),
        file: result.uri
      };

      await saveDownload(item);
      setProgress(0);

      await sendNotification('✅ تم التحميل', 'تم حفظ الفيديو');

    } catch {
      if (retry < MAX_RETRIES) {
        setTimeout(() => downloadVideo(retry + 1), 2000);
      } else {
        sendNotification('❌ فشل', 'فشل التحميل');
      }
    }
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Media Saver</Text>

      <TextInput
        placeholder="ضع رابط الفيديو"
        value={url}
        onChangeText={setUrl}
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={downloadVideo}>
        <Text style={styles.buttonText}>تحميل</Text>
      </TouchableOpacity>

      {progress > 0 && (
        <Text style={styles.progress}>جاري التحميل: {progress}%</Text>
      )}

      {currentVideo && (
        <Video
          source={{ uri: currentVideo }}
          useNativeControls
          style={{ height: 200 }}
        />
      )}

      <FlatList
        data={downloads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>

            <TouchableOpacity onPress={() => setCurrentVideo(item.file)}>
              <Text>▶ تشغيل</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => Sharing.shareAsync(item.file)}>
              <Text>📤 مشاركة</Text>
            </TouchableOpacity>

          </View>
        )}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },

  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20
  },

  input: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10
  },

  button: {
    backgroundColor: '#6366F1',
    padding: 15,
    borderRadius: 10
  },

  buttonText: {
    color: '#fff',
    textAlign: 'center'
  },

  progress: {
    textAlign: 'center',
    marginTop: 10
  },

  card: {
    padding: 10,
    borderWidth: 1,
    marginTop: 10
  }
});
