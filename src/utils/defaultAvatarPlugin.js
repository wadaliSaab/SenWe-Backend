export function generateAvatarUrl(name, size = 64) {
  const encodedName = encodeURIComponent(name || "User");
  return `https://ui-avatars.com/api/?name=${encodedName}&background=random&color=fff&bold=true&length=1&size=${size}`;
}
export function defaultAvatarPlugin(schema, options = {}) {
  const nameField = options.nameField || "username";

  
  schema.pre("save", function () {
    if (!this.avatar) {
      this.avatar = generateAvatarUrl(this[nameField]);
    }
  });
}