import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;

const CATEGORIES = ['Account Problem', 'Technical Issue', 'Payment Concern', 'Other'];

export default function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // --- Expo Image Picker ---
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Gallery access needed',
        'Allow photo access in Settings to attach a screenshot.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return; // user cancelled; keep current selection
    setImage(result.assets[0]);
  };

  // --- Cloudinary upload (unsigned preset) ---
  const uploadToCloudinary = async (asset) => {
    const data = new FormData();
    data.append('file', {
      uri: asset.uri,
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || 'screenshot.jpg',
    });
    data.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: data,
    });
    const json = await res.json();
    if (!res.ok || !json.secure_url) {
      throw new Error(json?.error?.message || 'Image upload failed');
    }
    return json.secure_url;
  };

  // --- EmailJS (REST API) ---
  const sendEmail = async (imageUrl) => {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        template_params: {
          name,
          reply_to: email,
          issue_category: category,
          message,
          image_url: imageUrl,
        },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
  };

  const validate = () => {
    if (!name.trim()) return 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
    if (!message.trim()) return 'Describe your problem.';
    if (!image) return 'Attach a screenshot.';
    return null;
  };

  const handleSubmit = async () => {
    if (loading) return; // block duplicate submissions
    const problem = validate();
    if (problem) {
      Alert.alert('Check the form', problem);
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      setStatus('Uploading screenshot…');
      const imageUrl = await uploadToCloudinary(image); // email only sends after this succeeds
      setStatus('Sending message…');
      await sendEmail(imageUrl);
      Alert.alert('Sent', 'Your support request was sent. We will reply by email.');
      setName(''); setEmail(''); setMessage(''); setImage(null); setCategory(CATEGORIES[0]);
      setStatus('');
    } catch (err) {
      setStatus('');
      Alert.alert('Could not send', String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Contact support</Text>
        <Text style={s.sub}>Tell us what went wrong and attach a screenshot.</Text>

        <Text style={s.label}>Name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Juan Dela Cruz" editable={!loading} />

        <Text style={s.label}>Email address</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com"
          keyboardType="email-address" autoCapitalize="none" editable={!loading} />

        <Text style={s.label}>Issue category</Text>
        <View style={s.chips}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c} disabled={loading} onPress={() => setCategory(c)}
              style={[s.chip, category === c && s.chipOn]}>
              <Text style={[s.chipText, category === c && s.chipTextOn]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Message</Text>
        <TextInput style={[s.input, s.multi]} value={message} onChangeText={setMessage}
          placeholder="What happened?" multiline editable={!loading} />

        <Text style={s.label}>Screenshot</Text>
        {image ? (
          <View>
            <Image source={{ uri: image.uri }} style={s.preview} resizeMode="contain" />
            <View style={s.row}>
              <TouchableOpacity style={s.secondary} onPress={pickImage} disabled={loading}>
                <Text style={s.secondaryText}>Change image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondary} onPress={() => setImage(null)} disabled={loading}>
                <Text style={s.secondaryText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s.secondary} onPress={pickImage} disabled={loading}>
            <Text style={s.secondaryText}>Choose screenshot</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[s.submit, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Send request</Text>}
        </TouchableOpacity>
        {!!status && <Text style={s.status}>{status}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, backgroundColor: '#f6f8fa', flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#12263a' },
  sub: { color: '#52606d', marginBottom: 16, marginTop: 4 },
  label: { fontWeight: '600', color: '#12263a', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd2d9', borderRadius: 8, padding: 12, fontSize: 16 },
  multi: { minHeight: 110, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#9aa5b1', backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#0b6e4f', borderColor: '#0b6e4f' },
  chipText: { color: '#323f4b' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  preview: { width: '100%', height: 220, borderRadius: 8, backgroundColor: '#e4e7eb' },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  secondary: { borderWidth: 1, borderColor: '#0b6e4f', borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  secondaryText: { color: '#0b6e4f', fontWeight: '600' },
  submit: { backgroundColor: '#0b6e4f', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  status: { textAlign: 'center', marginTop: 10, color: '#52606d' },
});