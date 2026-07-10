import { useState } from "react";
import {
  Stepper,
  Button,
  Group,
  TextInput,
  Code,
  SimpleGrid,
  Title,
  Stack,
  Input,
  Text,
  Card,
  Image,
  Checkbox,
  Textarea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import files from "../../assets/personal-files.png";
import library from "../../assets/library.png";
import dataanalysis from "../../assets/data-analysis.png";
import typing from "../../assets/typing.png";
import userreasearch from "../../assets/user-research.png";
import {
  IconDownload,
  IconUpload,
  IconSearch,
  IconUser,
  IconNote,
} from "@tabler/icons-react";
function SuchAntrag({
  neuesuchanfragedescription,
  ergebnisseanschauendescription,
  suchanfragedescription,
  inbearbeitungdescription,
  weitererecherchedescription,
  ergebnisdescription,
  ergebnisteilendescription,
  weitererechechebutton1description,
  weitererechechebutton1link,
  weitererechechebutton2description,
  weitererechechebutton2link,
  weitererechechebutton3description,
  weitererechechebutton3link,
  checkboxlabel,
}) {
  console.log(neuesuchanfragedescription);
  const [active, setActive] = useState(0);
  const [secondActive, setSecondActive] = useState(0);
  const [newForm, setNewForm] = useState(false);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      name: "",
      surname: "",
      birthname: "",
      othernames: "",
      birthplace: "",
      birthday: "",
      gender: "",
      lastknownresidence: "",
      adressoforigin: "",
      lastknowndateandtimeandplace: "",
      howareyourelated: "",
      reasonofsearch: "",
      applicantname: "",
      applicantsurname: "",
      applicantadress: "",
      applicantphone: "",
      applicantemail: "",
    },

    validate: (values) => {
      return {};
    },
  });

  const nextStep = () =>
    setActive((current) => {
      if (form.validate().hasErrors) {
        return current;
      }
      return current < 4 ? current + 1 : current;
    });

  const prevStep = () =>
    setActive((current) => (current > 0 ? current - 1 : current));

  const nextStepSecondActive = () =>
    setSecondActive((current) => {
      if (form.validate().hasErrors) {
        return current;
      }
      return current < 3 ? current + 1 : current;
    });

  const prevStepSecondActive = () =>
    setSecondActive((current) => (current > 0 ? current - 1 : current));

  return (
    <Stack>
      {active > 0 && form.getValues().applicantname && (
        <div>
          <Title>
            {form.getValues().applicantsurname +
              " " +
              form.getValues().applicantname}
          </Title>
          <Text>Antragsdatum: {new Date().toLocaleDateString("de-DE")}</Text>
        </div>
      )}
      <Stepper active={active}>
        <Stepper.Step label="Suchanfrage">
          {!newForm && (
            <Group justify="center" grow>
              <Stack align="flex-start">
                <Card style={{ width: "30rem" }}>
                  <Stack>
                    <Title order={2} fw={900} ta="left">
                      Neuen Suchantrag starten
                    </Title>
                    <Text
                      dangerouslySetInnerHTML={{
                        __html: neuesuchanfragedescription,
                      }}
                      mt="sm"
                      ta="left"
                    ></Text>
                    <Button
                      style={{ width: "10rem" }}
                      onClick={() => {
                        setNewForm(true);
                      }}
                    >
                      Starten
                    </Button>
                  </Stack>
                </Card>
                <Card style={{ width: "30rem" }}>
                  <Stack>
                    <Title order={2} fw={900} ta="left">
                      Ergebnisse anschauen
                    </Title>
                    <Text
                      mt="sm"
                      ta="left"
                      dangerouslySetInnerHTML={{
                        __html: ergebnisseanschauendescription,
                      }}
                    ></Text>
                    <Input placeholder="Trackingnummer" />
                    <Button
                      style={{ width: "10rem" }}
                      onClick={() => {
                        setActive(3);
                      }}
                    >
                      Ansehen
                    </Button>
                  </Stack>
                </Card>
              </Stack>
              <Image
                src={files}
                width={500}
                height={500}
                alt="Ein Bild, dass einen Aktenschrank zeigt, aus dem eine Person eine Akte nimmt."
                title="Ein Bild, dass einen Aktenschrank zeigt, aus dem eine Person eine Akte nimmt."
              />
            </Group>
          )}
          {newForm && (
            <Stack>
              <Title order={2} fw={900} ta="left">
                Suchanfrage
              </Title>
              <Text
                dangerouslySetInnerHTML={{
                  __html: suchanfragedescription,
                }}
              ></Text>
              <Stepper active={secondActive}>
                <Stepper.Step
                  icon={<IconSearch></IconSearch>}
                  label="Gesuchte Person"
                >
                  <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
                    <TextInput
                      label="Familienname"
                      placeholder="Der Familienname"
                      name="name"
                      variant="filled"
                      {...form.getInputProps("name")}
                    />
                    <TextInput
                      label="Vorname"
                      placeholder="Der Vorname"
                      name="surname"
                      variant="filled"
                      {...form.getInputProps("surname")}
                    />
                    <TextInput
                      label="Geburtsname"
                      placeholder="Der Geburtsname"
                      name="birthname"
                      variant="filled"
                      {...form.getInputProps("birthname")}
                    />
                    <TextInput
                      label="Weitere Namen"
                      placeholder="Weitere Namen"
                      name="othernames"
                      variant="filled"
                      {...form.getInputProps("othernames")}
                    />
                    <TextInput
                      label="Geburtsort"
                      placeholder="Geburtsort"
                      name="birthplace"
                      variant="filled"
                      {...form.getInputProps("birthplace")}
                    />
                    <TextInput
                      label="Geburtstag"
                      placeholder="Geburtstag"
                      name="birthday"
                      variant="filled"
                      {...form.getInputProps("birthday")}
                    />
                    <TextInput
                      label="Geschlecht"
                      placeholder="Geschlecht"
                      name="gender"
                      variant="filled"
                      {...form.getInputProps("gender")}
                    />
                    <TextInput
                      label="Letzter bekannter Wohnort"
                      placeholder="Letzter bekannter Wohnort"
                      name="lastknownresidence"
                      variant="filled"
                      {...form.getInputProps("lastknownresidence")}
                    />
                    <TextInput
                      label="Heimatanschrift am 01.09.1939"
                      placeholder="Heimatanschrift"
                      name="adressoforigin"
                      variant="filled"
                      {...form.getInputProps("adressoforigin")}
                    />
                    <TextInput
                      label="Letztes bekanntes Datum und Ort"
                      placeholder="Letztes bekanntes Datum und Ort"
                      name="lastknowndateandtimeandplace"
                      variant="filled"
                      {...form.getInputProps("lastknowndateandtimeandplace")}
                    />
                    <TextInput
                      label="Wie sind Sie verwandt?"
                      placeholder="Wie sind Sie verwandt?"
                      name="howareyourelated"
                      variant="filled"
                      {...form.getInputProps("howareyourelated")}
                    />
                    <TextInput
                      label="Grund der Suche"
                      placeholder="Grund der Suche"
                      name="reasonofsearch"
                      variant="filled"
                      {...form.getInputProps("reasonofsearch")}
                    />
                  </SimpleGrid>
                </Stepper.Step>
                <Stepper.Step
                  icon={<IconUser></IconUser>}
                  label="Suchende Person"
                >
                  <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
                    <TextInput
                      label="Familienname"
                      placeholder="Dein Familienname"
                      name="applicantname"
                      variant="filled"
                      {...form.getInputProps("applicantname")}
                    />
                    <TextInput
                      label="Vorname"
                      placeholder="Dein Vorname"
                      name="applicantsurname"
                      variant="filled"
                      {...form.getInputProps("applicantsurname")}
                    />

                    <TextInput
                      label="Deine Adresse"
                      placeholder="Deine Adresse"
                      name="applicantadress"
                      variant="filled"
                      {...form.getInputProps("applicantadress")}
                    />
                    <TextInput
                      label="Deine Telefonnummer"
                      placeholder="Deine Telefonnummer"
                      name="applicantphone"
                      variant="filled"
                      {...form.getInputProps("applicantphone")}
                    />
                    <TextInput
                      label="Deine E-Mail Adresse"
                      placeholder="Deine E-Mail Adresse"
                      name="applicantemail"
                      variant="filled"
                      {...form.getInputProps("applicantemail")}
                    />
                  </SimpleGrid>
                </Stepper.Step>
                <Stepper.Step
                  icon={<IconNote></IconNote>}
                  label="Zusammenfassung"
                >
                  <Code block mt="xl">
                    {JSON.stringify(form.getValues(), null, 2)}
                  </Code>
                </Stepper.Step>
              </Stepper>
              <Group justify="flex-end" mt="xl">
                {secondActive !== 0 && (
                  <Button variant="default" onClick={prevStepSecondActive}>
                    Zurück
                  </Button>
                )}
                {secondActive < 3 && (
                  <Button onClick={nextStepSecondActive}>
                    Nächster Schritt
                  </Button>
                )}
              </Group>
            </Stack>
          )}
        </Stepper.Step>

        <Stepper.Step label="In Bearbeitung">
          <Group justify="center" grow>
            <Stack align="flex-start">
              <Card style={{ width: "30rem" }}>
                <Stack>
                  <Title order={2} fw={900} ta="left">
                    In Bearbeitung
                  </Title>
                  <Text
                    dangerouslySetInnerHTML={{
                      __html: inbearbeitungdescription,
                    }}
                    mt="sm"
                    ta="left"
                  ></Text>
                  <Card>
                    <Text fw={700}>Trackingnummer:</Text>
                    <Text>DRK123456789</Text>
                  </Card>
                  <Button style={{ width: "15rem" }}>
                    Weitere Berichte anschauen
                  </Button>
                </Stack>
              </Card>
            </Stack>
            <Image
              src={library}
              width={500}
              height={500}
              alt="Ein Bild, dass zwei Menschen sitzend in einer Bibliothek zeigt."
              title="Ein Bild, dass zwei Menschen sitzend in einer Bibliothek zeigt."
            />
          </Group>
        </Stepper.Step>

        <Stepper.Step label="Weitere Recherche">
          <Group justify="center" grow>
            <Stack align="flex-start">
              <Card style={{ width: "30rem" }}>
                <Stack>
                  <Title order={2} fw={900} ta="left">
                    Weitere Recherchemöglichkeiten
                  </Title>
                  <Text
                    mt="sm"
                    ta="left"
                    dangerouslySetInnerHTML={{
                      __html: weitererecherchedescription,
                    }}
                  ></Text>
                  <Group>
                    <Button
                      component="a"
                      target="blank"
                      href={weitererechechebutton1link}
                    >
                      {weitererechechebutton1description}
                    </Button>
                    <Button
                      component="a"
                      target="blank"
                      href={weitererechechebutton2link}
                    >
                      {weitererechechebutton2description}
                    </Button>
                    <Button
                      component="a"
                      target="blank"
                      href={weitererechechebutton3link}
                    >
                      {weitererechechebutton3description}
                    </Button>
                  </Group>
                </Stack>
              </Card>
            </Stack>
            <Image
              src={dataanalysis}
              width={500}
              height={500}
              alt="Zwei Menschen, die auf Dashboards und Statistiken schauen."
              title="Zwei Menschen, die auf Dashboards und Statistiken schauen."
            />
          </Group>
        </Stepper.Step>
        <Stepper.Step label="Ergebnis">
          <Group justify="center" grow>
            <Stack align="flex-start">
              <Card style={{ width: "30rem" }}>
                <Stack>
                  <Title order={2} fw={900} ta="left">
                    Ergebnis DRK123456789
                  </Title>
                  <Text
                    mt="sm"
                    ta="left"
                    dangerouslySetInnerHTML={{
                      __html: ergebnisdescription,
                    }}
                  ></Text>
                  <Button
                    rightSection={<IconDownload />}
                    style={{ width: "15rem" }}
                  >
                    Dokumente herunterladen
                  </Button>
                  <Button style={{ width: "15rem" }}>Brief anfordern</Button>
                </Stack>
              </Card>
            </Stack>
            <Image
              src={userreasearch}
              width={500}
              height={500}
              alt="Zwei Menschen, die Steckbriefe von Nutzer*innen untersuchen."
              title="Zwei Menschen, die Steckbriefe von Nutzer*innen untersuchen."
            />
          </Group>
        </Stepper.Step>
        <Stepper.Completed>
          <Group justify="center" grow>
            <Stack align="flex-start">
              <Card style={{ width: "30rem" }}>
                <Stack>
                  <Title order={2} fw={900} ta="left">
                    Ergebnisse teilen
                  </Title>
                  <Text
                    mt="sm"
                    ta="left"
                    dangerouslySetInnerHTML={{
                      __html: ergebnisteilendescription,
                    }}
                  ></Text>
                  <Checkbox label={checkboxlabel}></Checkbox>
                  <Button
                    rightSection={<IconUpload />}
                    style={{ width: "15rem" }}
                  >
                    Dokumente hochladen
                  </Button>
                  <Textarea placeholder="Nachricht"></Textarea>
                  <Button style={{ width: "15rem" }}>Ergebnis teilen</Button>
                </Stack>
              </Card>
            </Stack>
            <Image
              src={typing}
              width={500}
              height={500}
              alt="Ein Laptop, auf dem eine Person etwas schreibt."
              title="Ein Laptop, auf dem eine Person etwas schreibt."
            />
          </Group>
        </Stepper.Completed>
      </Stepper>

      <Group justify="flex-end" mt="xl">
        {active !== 0 && (
          <Button variant="default" onClick={prevStep}>
            Zurück
          </Button>
        )}
        {active > 0 && active < 4 && (
          <Button onClick={nextStep}>Nächster Schritt</Button>
        )}
        {active === 0 && secondActive === 3 && (
          <Button onClick={nextStep}>Nächster Schritt</Button>
        )}
      </Group>
    </Stack>
  );
}

export default SuchAntrag;

export const metadata = {
  name: "SuchAntrag",
  description: "A simple multi-step form with validation",
  defaultProps: {
    neuesuchanfragedescription:
      "Bitte füllen Sie das Formular aus, um einen neuen Suchantrag zu starten.",
    ergebnisseanschauendescription:
      "Hier können Sie die Ergebnisse Ihres Suchantrags anschauen. Geben Sie dazu ihre Trackingnummer ein.",
    suchanfragedescription: "Bitte füllen Sie das Formular aus",
    inbearbeitungdescription:
      "Bitte füllen Sie das Formular aus, um einen neuen Suchantrag zu starten.",
    weitererecherchedescription:
      "Bitte füllen Sie das Formular aus, um einen neuen Suchantrag zu starten.",
    ergebnisdescription:
      "Bitte füllen Sie das Formular aus, um einen neuen Suchantrag zu starten.",
    ergebnisteilendescription:
      "Bitte füllen Sie das Formular aus, um einen neuen Suchantrag zu starten.",
    weitererechechebutton1description: "Link 1",
    weitererechechebutton1link: "https://www.google.com",
    weitererechechebutton2description: "Link 2",
    weitererechechebutton2link: "https://www.google.com",
    weitererechechebutton3description: "Link 3",
    weitererechechebutton3link: "https://www.google.com",
    checkboxlabel: "Ich erlaube dem DRK, meine Daten zu speichern",
  },
  editableProps: {
    neuesuchanfragedescription: "text",
    ergebnisseanschauendescription: "text",
    suchanfragedescription: "text",
    inbearbeitungdescription: "text",
    weitererecherchedescription: "text",
    ergebnisdescription: "text",
    ergebnisteilendescription: "text",
    weitererechechebutton1description: "string",
    weitererechechebutton1link: "string",
    weitererechechebutton2description: "string",
    weitererechechebutton2link: "string",
    weitererechechebutton3description: "string",
    weitererechechebutton3link: "string",
    checkboxlabel: "string",
  },
};
