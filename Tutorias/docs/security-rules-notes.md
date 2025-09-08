# Firebase security rules (suggested)

```
// Firestore: users collection
match /users/{uid} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == uid;
}

// Storage: avatars
match /avatars/{uid}.jpg {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == uid;
}
```

Adapt these rules in the Firebase console before deploying.
