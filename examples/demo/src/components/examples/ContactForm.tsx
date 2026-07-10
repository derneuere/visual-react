import {
  Button,
  Group,
  SimpleGrid,
  Textarea,
  TextInput,
  Title,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";

const ContactForm = () => {
  const form = useForm({
    initialValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
    validate: {
      name: (value) => value.trim().length < 2,
      email: (value) => !/^\S+@\S+$/.test(value),
      subject: (value) => value.trim().length === 0,
    },
  });

  return (
    <form onSubmit={form.onSubmit(() => {})}>
      <Title order={2} size="h1" fw={900} ta="left">
        Kontakt
      </Title>
      <Text size="lg" mt="sm" ta="left">
        Schreib uns eine Nachricht und wir melden uns bei dir!
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
        <TextInput
          label="Name"
          placeholder="Dein Name"
          name="name"
          variant="filled"
          {...form.getInputProps("name")}
        />
        <TextInput
          label="Email"
          placeholder="Deine E-Mail Adresse"
          name="email"
          variant="filled"
          {...form.getInputProps("email")}
        />
      </SimpleGrid>

      <TextInput
        label="Thema"
        placeholder="Thema"
        mt="md"
        name="subject"
        variant="filled"
        {...form.getInputProps("subject")}
      />
      <Textarea
        mt="md"
        label="Nachricht"
        placeholder="Deine Nachricht"
        maxRows={10}
        minRows={5}
        autosize
        name="message"
        variant="filled"
        {...form.getInputProps("message")}
      />

      <Group justify="left" mt="xl">
        <Button type="submit" size="md">
          Absenden
        </Button>
      </Group>
    </form>
  );
};

export default ContactForm;

export const metadata = {
  name: "ContactForm",
  description:
    "A simple contact form with name, email, subject, and message fields.",
  defaultProps: {},
  editableProps: {},
};
